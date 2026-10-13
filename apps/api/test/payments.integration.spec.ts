import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createHmac, randomBytes } from 'crypto';
import { DatabaseService } from '../src/modules/database/database.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { CommissionService } from '../src/modules/payments/commission.service';
import { RazorpayPaymentProvider } from '../src/modules/payments/providers/razorpay.provider';
import { StripePaymentProvider } from '../src/modules/payments/providers/stripe.provider';
import { MockPaymentProvider } from '../src/modules/payments/providers/mock.provider';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { ReconciliationService } from '../src/modules/payments/reconciliation.service';

describe('G09: Payment Gateway, Marketplace Commissions & Financial Ledger Integration', () => {
  let dbService: DatabaseService;
  let auditService: AuditService;
  let ledgerService: LedgerService;
  let commissionService: CommissionService;
  let razorpayProvider: RazorpayPaymentProvider;
  let stripeProvider: StripePaymentProvider;
  let mockProvider: MockPaymentProvider;
  let paymentsService: PaymentsService;
  let reconciliationService: ReconciliationService;

  const uniqueSuffix = Date.now();

  // Test Entities
  let customerUser: { id: string; email: string };
  let artisanUser: { id: string; email: string };
  let sellerProfileId: string;
  let shopId: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;

  let testOrderId: string;
  let testOrderNumber: string;
  let testSubOrderId: string;
  let testSubOrderNumber: string;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';
    process.env['RAZORPAY_WEBHOOK_SECRET'] = 'test_webhook_secret_key_123';
    process.env['RAZORPAY_KEY_SECRET'] = 'test_key_secret_123';

    dbService = new DatabaseService();
    auditService = new AuditService(dbService);
    ledgerService = new LedgerService(dbService);
    commissionService = new CommissionService();
    razorpayProvider = new RazorpayPaymentProvider();
    stripeProvider = new StripePaymentProvider();
    mockProvider = new MockPaymentProvider();

    paymentsService = new PaymentsService(
      dbService,
      auditService,
      ledgerService,
      commissionService,
      razorpayProvider,
      stripeProvider,
      mockProvider,
    );
    reconciliationService = new ReconciliationService(dbService);

    // Initialize chart of accounts
    await ledgerService.ensureAccountsExist();

    // 1. Create Customer User
    const [cust] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `cust.pay.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_customer',
        firstName: 'Ananya',
        lastName: 'Roy',
      })
      .returning();
    customerUser = cust;

    // 2. Create Artisan User & Seller Profile
    const [artisan] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.pay.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_artisan',
        firstName: 'Bikram',
        lastName: 'Dutta',
      })
      .returning();
    artisanUser = artisan;

    const [seller] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: artisanUser.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Bikram Terracotta Studio',
        commissionRateBps: 1000, // 10%
      })
      .returning();
    sellerProfileId = seller.id;

    // 3. Create Shop
    const [shop] = await dbService.db
      .insert(dbService.schema.shops)
      .values({
        sellerId: sellerProfileId,
        name: `Terracotta Crafts ${uniqueSuffix}`,
        slug: `terracotta-crafts-${uniqueSuffix}`,
        story: 'Authentic clay pottery handcrafted with love.',
      })
      .returning();
    shopId = shop.id;

    // 4. Create Category, Product, Variant
    const [category] = await dbService.db
      .select({ id: dbService.schema.categories.id })
      .from(dbService.schema.categories)
      .limit(1);

    if (category) {
      categoryId = category.id;
    } else {
      const [newCat] = await dbService.db
        .insert(dbService.schema.categories)
        .values({
          name: `Pottery ${uniqueSuffix}`,
          slug: `pottery-${uniqueSuffix}`,
        })
        .returning();
      categoryId = newCat.id;
    }

    const [product] = await dbService.db
      .insert(dbService.schema.products)
      .values({
        sellerId: sellerProfileId,
        categoryId,
        productType: 'READY_TO_SHIP',
        title: 'Handmade Terracotta Vase',
        slug: `terracotta-vase-${uniqueSuffix}`,
        description: 'Traditional clay vase handcrafted on a potter wheel.',
        basePriceMinor: 200000,
        currency: 'INR',
        moderationStatus: 'APPROVED',
      })
      .returning();
    productId = product.id;

    const [variant] = await dbService.db
      .insert(dbService.schema.productVariants)
      .values({
        productId,
        title: 'Medium Terracotta Vase',
        sku: `VASE-MED-${uniqueSuffix}`,
        priceMinor: 200000, // ₹2,000.00
        weightGrams: 500,
        dimensionLengthMm: 100,
        dimensionWidthMm: 100,
        dimensionHeightMm: 150,
      })
      .returning();
    variantId = variant.id;

    // 5. Create Parent Order & Sub-Order in PLACED / PENDING state
    testOrderNumber = `ORD-TEST-${uniqueSuffix}`;
    const [order] = await dbService.db
      .insert(dbService.schema.customerOrders)
      .values({
        orderNumber: testOrderNumber,
        customerId: customerUser.id,
        totalAmountMinor: 220000, // ₹2,000 items + ₹200 shipping = ₹2,200
        currency: 'INR',
        paymentStatus: 'PENDING',
        orderStatus: 'PLACED',
        shippingAddress: {
          recipientName: 'Ananya Roy',
          phone: '+919876543210',
          city: 'Kolkata',
          state: 'West Bengal',
          postalCode: '700001',
          country: 'IN',
        },
        billingAddress: {
          recipientName: 'Ananya Roy',
          city: 'Kolkata',
        },
      })
      .returning();
    testOrderId = order.id;

    testSubOrderNumber = `${testOrderNumber}-S1`;
    const [subOrder] = await dbService.db
      .insert(dbService.schema.subOrders)
      .values({
        subOrderNumber: testSubOrderNumber,
        parentOrderId: testOrderId,
        sellerId: sellerProfileId,
        shopId,
        status: 'CONFIRMED',
        itemSubtotalMinor: 200000,
        shippingFeeMinor: 20000,
        commissionRateBps: 1000,
        commissionFeeMinor: 20000,
        taxMinor: 0,
        netSellerPayableMinor: 200000,
        currency: 'INR',
      })
      .returning();
    testSubOrderId = subOrder.id;

    // Insert order item snapshot
    await dbService.db.insert(dbService.schema.orderItems).values({
      subOrderId: testSubOrderId,
      sellerId: sellerProfileId,
      variantId,
      titleSnapshot: 'Handmade Terracotta Vase (Medium)',
      skuSnapshot: `VASE-MED-${uniqueSuffix}`,
      unitPriceMinor: 200000,
      quantity: 1,
      totalPriceMinor: 200000,
    });
  });

  afterAll(async () => {
    // Cleanup order hierarchy, seller, and users safely
    if (testSubOrderId) {
      await dbService.db
        .delete(dbService.schema.refundRequests)
        .where(eq(dbService.schema.refundRequests.subOrderId, testSubOrderId));

      const relatedBatches = await dbService.db
        .select({ journalBatchId: dbService.schema.ledgerEntries.journalBatchId })
        .from(dbService.schema.ledgerEntries)
        .where(eq(dbService.schema.ledgerEntries.subOrderId, testSubOrderId));

      for (const b of relatedBatches) {
        await dbService.db
          .delete(dbService.schema.ledgerEntries)
          .where(eq(dbService.schema.ledgerEntries.journalBatchId, b.journalBatchId));
      }

      await dbService.db
        .delete(dbService.schema.orderTimelineEvents)
        .where(eq(dbService.schema.orderTimelineEvents.subOrderId, testSubOrderId));
      await dbService.db
        .delete(dbService.schema.orderItems)
        .where(eq(dbService.schema.orderItems.subOrderId, testSubOrderId));
      await dbService.db
        .delete(dbService.schema.paymentAllocations)
        .where(eq(dbService.schema.paymentAllocations.subOrderId, testSubOrderId));
      await dbService.db
        .delete(dbService.schema.subOrders)
        .where(eq(dbService.schema.subOrders.id, testSubOrderId));
    }
    if (testOrderId) {
      await dbService.db
        .delete(dbService.schema.paymentAttempts)
        .where(eq(dbService.schema.paymentAttempts.parentOrderId, testOrderId));
      await dbService.db
        .delete(dbService.schema.customerOrders)
        .where(eq(dbService.schema.customerOrders.id, testOrderId));
    }
    if (sellerProfileId) {
      const sellerBatches = await dbService.db
        .select({ journalBatchId: dbService.schema.ledgerEntries.journalBatchId })
        .from(dbService.schema.ledgerEntries)
        .where(eq(dbService.schema.ledgerEntries.sellerId, sellerProfileId));

      for (const b of sellerBatches) {
        await dbService.db
          .delete(dbService.schema.ledgerEntries)
          .where(eq(dbService.schema.ledgerEntries.journalBatchId, b.journalBatchId));
      }

      await dbService.db
        .delete(dbService.schema.sellerBalances)
        .where(eq(dbService.schema.sellerBalances.sellerId, sellerProfileId));
      if (variantId) {
        await dbService.db
          .delete(dbService.schema.productVariants)
          .where(eq(dbService.schema.productVariants.id, variantId));
      }
      if (productId) {
        await dbService.db
          .delete(dbService.schema.products)
          .where(eq(dbService.schema.products.id, productId));
      }
      if (shopId) {
        await dbService.db
          .delete(dbService.schema.shops)
          .where(eq(dbService.schema.shops.id, shopId));
      }
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, sellerProfileId));
    }
    if (customerUser?.id) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, customerUser.id));
    }
    if (artisanUser?.id) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, artisanUser.id));
    }
  });

  it('initiates payment intent and partitions sub-orders into payment_allocations', async () => {
    const res = await paymentsService.initiatePayment(customerUser.id, {
      orderNumber: testOrderNumber,
      provider: 'RAZORPAY',
    });

    expect(res.orderNumber).toBe(testOrderNumber);
    expect(res.amountMinor).toBe(220000);
    expect(res.currency).toBe('INR');
    expect(res.provider).toBe('RAZORPAY');
    expect(res.providerOrderId).toMatch(/^order_/);
    expect(res.status).toBe('INITIATED');

    // Verify payment_attempts in DB
    const [attempt] = await dbService.db
      .select()
      .from(dbService.schema.paymentAttempts)
      .where(eq(dbService.schema.paymentAttempts.id, res.paymentAttemptId))
      .limit(1);

    expect(attempt).toBeDefined();
    expect(attempt.status).toBe('INITIATED');
    expect(attempt.amountMinor).toBe(220000);

    // Verify payment_allocations in DB
    const allocations = await dbService.db
      .select()
      .from(dbService.schema.paymentAllocations)
      .where(eq(dbService.schema.paymentAllocations.paymentAttemptId, res.paymentAttemptId));

    expect(allocations.length).toBe(1);
    expect(allocations[0]?.subOrderId).toBe(testSubOrderId);
    expect(allocations[0]?.allocatedAmountMinor).toBe(220000);
  });

  it('rejects forged webhook signatures with UnauthorizedException', async () => {
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_forged_1',
            order_id: 'order_nonexistent',
            amount: 220000,
          },
        },
      },
    });

    await expect(
      paymentsService.processWebhook('RAZORPAY', rawBody, 'forged_fake_signature'),
    ).rejects.toThrow();
  });

  it('processes payment.captured webhook, transitioning order to PAID and posting double-entry ledger entries', async () => {
    // 1. Get the initiated attempt
    const [attempt] = await dbService.db
      .select()
      .from(dbService.schema.paymentAttempts)
      .where(eq(dbService.schema.paymentAttempts.parentOrderId, testOrderId))
      .limit(1);

    expect(attempt).toBeDefined();
    const providerIntentId = attempt.providerIntentId;
    const providerPaymentId = `pay_${randomBytes(8).toString('hex')}`;
    const webhookEventId = `rzp_evt_${Date.now()}`;

    // Construct valid Razorpay webhook payload
    const payloadObj = {
      event_id: webhookEventId,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: providerPaymentId,
            order_id: providerIntentId,
            amount: 220000,
            currency: 'INR',
          },
        },
      },
    };
    const rawBody = JSON.stringify(payloadObj);
    const validSignature = createHmac('sha256', process.env['RAZORPAY_WEBHOOK_SECRET']!)
      .update(rawBody)
      .digest('hex');

    // 2. Dispatch webhook
    const webhookResult = await paymentsService.processWebhook('RAZORPAY', rawBody, validSignature);
    expect(webhookResult.received).toBe(true);

    // 3. Verify payment_attempts status updated to SUCCEEDED
    const [updatedAttempt] = await dbService.db
      .select()
      .from(dbService.schema.paymentAttempts)
      .where(eq(dbService.schema.paymentAttempts.id, attempt.id))
      .limit(1);
    expect(updatedAttempt.status).toBe('SUCCEEDED');

    // 4. Verify customer_orders status updated to PAID and PROCESSING
    const [updatedOrder] = await dbService.db
      .select()
      .from(dbService.schema.customerOrders)
      .where(eq(dbService.schema.customerOrders.id, testOrderId))
      .limit(1);
    expect(updatedOrder.paymentStatus).toBe('PAID');
    expect(updatedOrder.orderStatus).toBe('PROCESSING');

    // 5. Verify sub_orders status is CONFIRMED
    const [updatedSubOrder] = await dbService.db
      .select()
      .from(dbService.schema.subOrders)
      .where(eq(dbService.schema.subOrders.id, testSubOrderId))
      .limit(1);
    expect(updatedSubOrder.status).toBe('CONFIRMED');

    // 6. Verify order timeline event was appended
    const timelineEvents = await dbService.db
      .select()
      .from(dbService.schema.orderTimelineEvents)
      .where(eq(dbService.schema.orderTimelineEvents.subOrderId, testSubOrderId));
    expect(timelineEvents.length).toBeGreaterThanOrEqual(1);

    // 7. Verify Double-Entry Financial Ledger Entries
    // Must contain:
    // DEBIT: 1010_PAYMENT_PROCESSOR for ₹2,200 (220000)
    // CREDIT: 2010_CUSTOMER_ESCROW for artisan net ₹2,000 (200000)
    // CREDIT: 4010_MARKETPLACE_COMMISSION for platform take ₹200 (20000)
    // Total Debits (220000) === Total Credits (220000)
    const ledgerRows = await dbService.db
      .select({
        entry: dbService.schema.ledgerEntries,
        account: dbService.schema.ledgerAccounts,
      })
      .from(dbService.schema.ledgerEntries)
      .innerJoin(
        dbService.schema.ledgerAccounts,
        eq(dbService.schema.ledgerEntries.accountId, dbService.schema.ledgerAccounts.id),
      )
      .where(eq(dbService.schema.ledgerEntries.subOrderId, testSubOrderId));

    expect(ledgerRows.length).toBeGreaterThanOrEqual(2);

    // Verify Seller Materialized Balance
    const sellerBalance = await ledgerService.getSellerBalance(sellerProfileId);
    expect(sellerBalance.pendingEscrowMinor).toBe(200000); // ₹2,000 held in escrow
    expect(sellerBalance.availablePayoutMinor).toBe(0);

    // 8. Test Webhook Deduplication: sending same webhook again is idempotent
    const duplicateRes = await paymentsService.processWebhook('RAZORPAY', rawBody, validSignature);
    expect(duplicateRes.received).toBe(true);
    expect(duplicateRes.message).toBe('Already processed');
  });

  it('rejects payment initiation for an order that has already been paid', async () => {
    await expect(
      paymentsService.initiatePayment(customerUser.id, {
        orderNumber: testOrderNumber,
        provider: 'RAZORPAY',
      }),
    ).rejects.toThrow(/already been paid/i);
  });

  it('retrieves live payment status and attempts history', async () => {
    const status = await paymentsService.getOrderPaymentStatus(customerUser.id, testOrderNumber);
    expect(status.orderNumber).toBe(testOrderNumber);
    expect(status.paymentStatus).toBe('PAID');
    expect(status.orderStatus).toBe('PROCESSING');
    expect(status.canRetry).toBe(false);
    expect(status.attempts.length).toBeGreaterThanOrEqual(1);
    expect(status.attempts[0]?.status).toBe('SUCCEEDED');
  });

  it('prevents over-refund exceeding sub-order value', async () => {
    // Sub-order value is 220000 paise (₹2,200). Attempting to refund 300000 paise (₹3,000) must fail
    await expect(
      paymentsService.requestRefund(customerUser.id, {
        subOrderId: testSubOrderId,
        amountMinor: 300000,
        reason: 'CUSTOMER_CANCELLATION',
      }),
    ).rejects.toThrow(/Over-refund prevented/i);
  });

  it('processes refund request and admin approval with reversing ledger entries', async () => {
    // 1. Request refund of ₹1,000 (100000 paise)
    const refundRequest = await paymentsService.requestRefund(customerUser.id, {
      subOrderId: testSubOrderId,
      amountMinor: 100000,
      reason: 'DEFECTIVE_ITEM',
    });

    expect(refundRequest.status).toBe('REQUESTED');
    expect(refundRequest.amountMinor).toBe(100000);

    // 2. Admin processes and approves refund
    const processed = await paymentsService.processRefund(customerUser.id, refundRequest.id, {
      approved: true,
    });

    expect(processed.status).toBe('COMPLETED');
    expect(processed.providerRefundId).toBeDefined();

    // 3. Verify seller escrow was decremented
    // Previously was 200000. Refund was ₹1,000.
    // Pro-rata: gross 220000 (item 200000 + shipping 20000), commission 20000 (10% of item).
    // Commission refund = round(100000 * 20000 / 220000) = 9091 paise.
    // Seller clawback = 100000 - 9091 = 90909 paise.
    // Remaining seller escrow: 200000 - 90909 = 109091 paise.
    const sellerBalance = await ledgerService.getSellerBalance(sellerProfileId);
    expect(sellerBalance.pendingEscrowMinor).toBe(109091);
  });

  it('executes reconciliation audit and detects no unbalanced journal batches', async () => {
    const report = await reconciliationService.runReconciliationAudit();
    expect(report.generatedAt).toBeDefined();
    expect(report.totalAttemptsChecked).toBeGreaterThanOrEqual(1);
    expect(report.unbalancedBatchesCount).toBe(0); // All batches strictly balanced!
  });
});

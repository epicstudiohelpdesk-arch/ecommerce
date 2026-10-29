import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../src/modules/database/database.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { CommissionService } from '../src/modules/payments/commission.service';
import { RazorpayPaymentProvider } from '../src/modules/payments/providers/razorpay.provider';
import { StripePaymentProvider } from '../src/modules/payments/providers/stripe.provider';
import { MockPaymentProvider } from '../src/modules/payments/providers/mock.provider';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { ReconciliationService } from '../src/modules/payments/reconciliation.service';
import { ProductModerationService } from '../src/modules/catalog/product-moderation.service';
import { SellerReviewService } from '../src/modules/sellers/seller-review.service';
import { SellerDocumentsStorageService } from '../src/modules/sellers/seller-documents-storage.service';
import { SupportCasesService } from '../src/modules/trust-support/support-cases.service';
import { DisputesService } from '../src/modules/trust-support/disputes.service';
import { PolicyViolationsService } from '../src/modules/trust-support/policy-violations.service';
import { RiskReviewService } from '../src/modules/trust-support/risk-review.service';
import { PrivacyComplianceService } from '../src/modules/trust-support/privacy-compliance.service';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe.skip('G13: Trust, Compliance, Customer Support & Fraud Workflows Integration Suite', () => {
  let dbService: DatabaseService;
  let auditService: AuditService;
  let ledgerService: LedgerService;
  let commissionService: CommissionService;
  let razorpayProvider: RazorpayPaymentProvider;
  let stripeProvider: StripePaymentProvider;
  let mockProvider: MockPaymentProvider;
  let paymentsService: PaymentsService;
  let reconciliationService: ReconciliationService;
  let moderationService: ProductModerationService;
  let sellerStorageService: SellerDocumentsStorageService;
  let sellerReviewService: SellerReviewService;

  let supportCasesService: SupportCasesService;
  let disputesService: DisputesService;
  let policyViolationsService: PolicyViolationsService;
  let riskReviewService: RiskReviewService;
  let privacyComplianceService: PrivacyComplianceService;

  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);

  function createMockExecutionContext(roles: string[], allowedRoles?: string[]): ExecutionContext {
    reflector.getAllAndOverride = () => allowedRoles;
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles, id: 'test-user-id' },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  const suffix = Date.now();

  // Test Entities
  let customerUser1: { id: string; email: string };
  let customerUser2: { id: string; email: string };
  let artisanUser1: { id: string; email: string };
  let artisanUser2: { id: string; email: string };
  let sellerProfile1: { id: string };
  let sellerProfile2: { id: string };
  let shop1: { id: string };
  let categoryId: string;
  let testProductId: string;
  let testVariantId: string;
  let testOrderId: string;
  let testSubOrderId: string;
  let staffUser: { id: string; email: string };

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
    moderationService = new ProductModerationService(dbService, auditService);
    sellerStorageService = new SellerDocumentsStorageService();
    sellerReviewService = new SellerReviewService(dbService, auditService, sellerStorageService);

    supportCasesService = new SupportCasesService(dbService, auditService);
    disputesService = new DisputesService(dbService, paymentsService, auditService);
    policyViolationsService = new PolicyViolationsService(
      dbService,
      moderationService,
      sellerReviewService,
      auditService,
    );
    riskReviewService = new RiskReviewService(dbService, auditService);
    privacyComplianceService = new PrivacyComplianceService(dbService, auditService);

    const schema = dbService.schema;
    const db = dbService.db;

    // Staff User
    const [staff] = await db
      .insert(schema.users)
      .values({
        email: `staff.trust.${suffix}@platform.local`,
        passwordHash: 'dummy_hash',
        firstName: 'Staff',
        lastName: 'Officer',
      })
      .returning();
    staffUser = staff;

    // Customer 1
    const [cust1] = await db
      .insert(schema.users)
      .values({
        email: `cust1.trust.${suffix}@example.com`,
        passwordHash: 'dummy_hash',
        firstName: 'Ananya',
        lastName: 'Rao',
        phone: '+919876543201',
      })
      .returning();
    customerUser1 = cust1;

    // Customer 2
    const [cust2] = await db
      .insert(schema.users)
      .values({
        email: `cust2.trust.${suffix}@example.com`,
        passwordHash: 'dummy_hash',
        firstName: 'Vikram',
        lastName: 'Seth',
        phone: '+919876543202',
      })
      .returning();
    customerUser2 = cust2;

    // Artisan 1
    const [artisan1] = await db
      .insert(schema.users)
      .values({
        email: `artisan1.trust.${suffix}@example.com`,
        passwordHash: 'dummy_hash',
        firstName: 'Priya',
        lastName: 'Crafts',
      })
      .returning();
    artisanUser1 = artisan1;

    const [selProf1] = await db
      .insert(schema.sellerProfiles)
      .values({
        userId: artisanUser1.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Priya Handloom Studio',
        verificationStatus: 'VERIFIED',
        commissionRateBps: 1000,
      })
      .returning();
    sellerProfile1 = selProf1;

    const [sh1] = await db
      .insert(schema.shops)
      .values({
        sellerId: sellerProfile1.id,
        name: 'Priya Handlooms',
        slug: `priya-handlooms-${suffix}`,
        status: 'ACTIVE',
      })
      .returning();
    shop1 = sh1;

    // Artisan 2
    const [artisan2] = await db
      .insert(schema.users)
      .values({
        email: `artisan2.trust.${suffix}@example.com`,
        passwordHash: 'dummy_hash',
        firstName: 'Kabir',
        lastName: 'Woodwork',
      })
      .returning();
    artisanUser2 = artisan2;

    const [selProf2] = await db
      .insert(schema.sellerProfiles)
      .values({
        userId: artisanUser2.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Kabir Woodcrafts',
        verificationStatus: 'VERIFIED',
        commissionRateBps: 1000,
      })
      .returning();
    sellerProfile2 = selProf2;

    // Category & Product
    const [cat] = await db
      .insert(schema.categories)
      .values({
        name: `Handloom Textiles ${suffix}`,
        slug: `handlooms-${suffix}`,
      })
      .returning();
    categoryId = cat.id;

    const [prod] = await db
      .insert(schema.products)
      .values({
        sellerId: sellerProfile1.id,
        categoryId: categoryId,
        productType: 'READY_TO_SHIP',
        title: 'Kalamkari Silk Shawl',
        slug: `kalamkari-shawl-${suffix}`,
        description: 'Authentic hand-painted silk shawl.',
        basePriceMinor: 200000,
        moderationStatus: 'APPROVED',
      })
      .returning();
    testProductId = prod.id;

    const [variant] = await db
      .insert(schema.productVariants)
      .values({
        productId: testProductId,
        sku: `SHAWL-${suffix}`,
        title: 'Indigo Kalamkari Silk Shawl',
        priceMinor: 200000,
        weightGrams: 300,
        dimensionLengthMm: 200,
        dimensionWidthMm: 100,
        dimensionHeightMm: 50,
      })
      .returning();
    testVariantId = variant.id;

    // Order & Sub-Order
    const [order] = await db
      .insert(schema.customerOrders)
      .values({
        orderNumber: `ORD-TRUST-${suffix}`,
        customerId: customerUser1.id,
        totalAmountMinor: 220000,
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
        shippingAddress: {
          recipientName: 'Ananya Rao',
          phone: '+919876543201',
          addressLine1: '10 Richmond Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560025',
          country: 'IN',
        },
        billingAddress: {
          recipientName: 'Ananya Rao',
          phone: '+919876543201',
          addressLine1: '10 Richmond Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560025',
          country: 'IN',
        },
      })
      .returning();
    testOrderId = order.id;

    const [subOrder] = await db
      .insert(schema.subOrders)
      .values({
        subOrderNumber: `SUB-TRUST-${suffix}`,
        parentOrderId: testOrderId,
        sellerId: sellerProfile1.id,
        shopId: shop1.id,
        status: 'DELIVERED',
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

    // Order Item
    await db.insert(schema.orderItems).values({
      subOrderId: testSubOrderId,
      sellerId: sellerProfile1.id,
      variantId: testVariantId,
      titleSnapshot: 'Kalamkari Silk Shawl',
      skuSnapshot: `SHAWL-${suffix}`,
      unitPriceMinor: 200000,
      quantity: 1,
      totalPriceMinor: 200000,
    });

    // Payment Attempt
    await db.insert(schema.paymentAttempts).values({
      parentOrderId: testOrderId,
      provider: 'MOCK_PROVIDER',
      providerIntentId: `mock_intent_${suffix}`,
      amountMinor: 220000,
      currency: 'INR',
      status: 'SUCCEEDED',
      idempotencyKey: `idem_${suffix}`,
    });

    // Seed Balanced Ledger Entries for testSubOrderId (Simulating Captured Payment)
    // 1010 DEBIT 220000, 2010 CREDIT 200000, 4010 CREDIT 20000
    const [acc1010] = await db
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.code, '1010_PAYMENT_PROCESSOR'));
    const [acc2010] = await db
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.code, '2010_CUSTOMER_ESCROW'));
    const [acc4010] = await db
      .select()
      .from(schema.ledgerAccounts)
      .where(eq(schema.ledgerAccounts.code, '4010_MARKETPLACE_COMMISSION'));

    const batchId = randomUUID();
    await db.insert(schema.ledgerEntries).values([
      {
        journalBatchId: batchId,
        accountId: acc1010.id,
        entryType: 'DEBIT',
        amountMinor: 220000,
        currency: 'INR',
        sellerId: sellerProfile1.id,
        subOrderId: testSubOrderId,
        description: 'Mock Payment Capture',
      },
      {
        journalBatchId: batchId,
        accountId: acc2010.id,
        entryType: 'CREDIT',
        amountMinor: 200000,
        currency: 'INR',
        sellerId: sellerProfile1.id,
        subOrderId: testSubOrderId,
        description: 'Customer Escrow Reserve',
      },
      {
        journalBatchId: batchId,
        accountId: acc4010.id,
        entryType: 'CREDIT',
        amountMinor: 200000 * 0.1,
        currency: 'INR',
        sellerId: sellerProfile1.id,
        subOrderId: testSubOrderId,
        description: 'Marketplace Commission Earned',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup records in reverse order
    const schema = dbService.schema;
    const db = dbService.db;

    if (testSubOrderId) {
      await db
        .delete(schema.supportTickets)
        .where(eq(schema.supportTickets.subOrderId, testSubOrderId));
      await db.delete(schema.disputes).where(eq(schema.disputes.subOrderId, testSubOrderId));
      await db
        .delete(schema.refundRequests)
        .where(eq(schema.refundRequests.subOrderId, testSubOrderId));
      await db
        .delete(schema.ledgerEntries)
        .where(eq(schema.ledgerEntries.subOrderId, testSubOrderId));
      await db.delete(schema.orderItems).where(eq(schema.orderItems.subOrderId, testSubOrderId));
      await db.delete(schema.subOrders).where(eq(schema.subOrders.id, testSubOrderId));
    }
    if (testOrderId) {
      await db
        .delete(schema.paymentAttempts)
        .where(eq(schema.paymentAttempts.parentOrderId, testOrderId));
      await db.delete(schema.customerOrders).where(eq(schema.customerOrders.id, testOrderId));
    }
    if (testProductId) {
      await db.delete(schema.policyReports).where(eq(schema.policyReports.targetId, testProductId));
      await db
        .delete(schema.productVariants)
        .where(eq(schema.productVariants.productId, testProductId));
      await db.delete(schema.products).where(eq(schema.products.id, testProductId));
    }
    if (shop1) {
      await db.delete(schema.shops).where(eq(schema.shops.id, shop1.id));
    }
    if (sellerProfile1) {
      await db.delete(schema.sellerProfiles).where(eq(schema.sellerProfiles.id, sellerProfile1.id));
    }
    if (sellerProfile2) {
      await db.delete(schema.sellerProfiles).where(eq(schema.sellerProfiles.id, sellerProfile2.id));
    }
    if (customerUser1) {
      await db.delete(schema.users).where(eq(schema.users.id, customerUser1.id));
    }
    if (customerUser2) {
      await db.delete(schema.users).where(eq(schema.users.id, customerUser2.id));
    }
    if (artisanUser1) {
      await db.delete(schema.users).where(eq(schema.users.id, artisanUser1.id));
    }
    if (artisanUser2) {
      await db.delete(schema.users).where(eq(schema.users.id, artisanUser2.id));
    }
    if (staffUser) {
      await db.delete(schema.users).where(eq(schema.users.id, staffUser.id));
    }
  });

  describe('1. Customer Support Cases & Confidential Internal Notes', () => {
    let createdTicketId: string;

    it('customer creates a support ticket linked to their sub-order', async () => {
      const ticket = await supportCasesService.createTicket(
        customerUser1.id,
        {
          subject: 'Delivery question for silk shawl',
          message: 'The package arrived on time, but I need care instructions.',
          category: 'ORDER_INQUIRY',
          priority: 'NORMAL',
          subOrderId: testSubOrderId,
        },
        'CUSTOMER',
      );

      expect(ticket).toBeDefined();
      expect(ticket.id).toBeDefined();
      expect(ticket.ticketNumber).toMatch(/^TCK-/);
      expect(ticket.status).toBe('OPEN');
      expect(ticket.customerId).toBe(customerUser1.id);
      expect(ticket.subOrderId).toBe(testSubOrderId);
      createdTicketId = ticket.id;
    });

    it('customer can list and view their own tickets, but other customers cannot access it', async () => {
      const list = await supportCasesService.listCustomerTickets(customerUser1.id, {
        page: 1,
        limit: 10,
      });
      expect(list.items.some((t) => t.id === createdTicketId)).toBe(true);

      // Customer 2 attempting to view Customer 1 ticket must fail with NotFoundException (tenant isolation)
      await expect(
        supportCasesService.getTicketById(customerUser2.id, createdTicketId, 'CUSTOMER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('staff adds an internal note (isInternal: true) and public response', async () => {
      // 1. Staff adds internal note (for support staff eyes only)
      const internalMsg = await supportCasesService.addMessage(
        staffUser.id,
        createdTicketId,
        {
          message:
            'Internal review: Buyer has requested silk dry-clean guide. Checked artisan specs.',
          isInternal: true,
        },
        'STAFF',
      );
      expect(internalMsg.isInternal).toBe(true);

      // 2. Staff adds public message for customer
      const publicMsg = await supportCasesService.addMessage(
        staffUser.id,
        createdTicketId,
        {
          message: 'Hello Ananya, we recommend dry cleaning only for natural vegetable dyes.',
          isInternal: false,
        },
        'STAFF',
      );
      expect(publicMsg.isInternal).toBe(false);
    });

    it('customer views ticket messages and internal notes are STRICTLY redacted', async () => {
      const messages = await supportCasesService.getTicketMessages(
        customerUser1.id,
        createdTicketId,
        'CUSTOMER',
      );

      // Verify that none of the messages visible to customer have isInternal === true
      expect(messages.length).toBeGreaterThanOrEqual(2); // Initial ticket message + public staff reply
      expect(messages.every((m) => m.isInternal === false)).toBe(true);
      expect(messages.some((m) => m.message.includes('Internal review: Buyer'))).toBe(false);
    });

    it('staff views ticket messages and internal notes ARE visible to staff', async () => {
      const messages = await supportCasesService.getTicketMessages(
        staffUser.id,
        createdTicketId,
        'STAFF',
      );

      expect(messages.some((m) => m.isInternal === true)).toBe(true);
      expect(messages.some((m) => m.message.includes('Internal review: Buyer'))).toBe(true);
    });

    it('customer cannot post internal notes (forced to false for customer role)', async () => {
      const custMsg = await supportCasesService.addMessage(
        customerUser1.id,
        createdTicketId,
        {
          message: 'Thank you for the guidance!',
          isInternal: true, // Malicious customer attempting to post internal note
        },
        'CUSTOMER',
      );

      // Server-authoritative logic forces isInternal: false when user is not staff
      expect(custMsg.isInternal).toBe(false);
    });

    it('staff assigns ticket, updates status to IN_PROGRESS, then RESOLVED', async () => {
      const updated = await supportCasesService.adminUpdateTicket(staffUser.id, createdTicketId, {
        assignedToStaffId: staffUser.id,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      });

      expect(updated.assignedToStaffId).toBe(staffUser.id);
      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.priority).toBe('HIGH');

      const resolved = await supportCasesService.adminUpdateTicket(staffUser.id, createdTicketId, {
        status: 'RESOLVED',
      });
      expect(resolved.status).toBe('RESOLVED');
    });
  });

  describe('2. Artisan Sub-Order Disputes & Balanced Refund Arbitration', () => {
    let disputeId: string;

    it('prevents dispute claim amount exceeding sub-order total (over-claim guard)', async () => {
      // Sub-order total is 220,000 paise (₹2,200). Attempting dispute for 500,000 paise must fail
      await expect(
        disputesService.createDispute(customerUser1.id, {
          subOrderId: testSubOrderId,
          reason: 'ITEM_DAMAGED',
          claimAmountMinor: 500000,
          customerStatement: 'Claiming more than order total.',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('customer files a valid dispute on their sub-order', async () => {
      const dispute = await disputesService.createDispute(customerUser1.id, {
        subOrderId: testSubOrderId,
        reason: 'ITEM_DAMAGED',
        claimAmountMinor: 50000, // ₹500 partial claim
        customerStatement: 'Minor tear on the border edge of the shawl.',
        evidenceUrls: ['https://storage.marketplace.internal/evidence/tear.jpg'],
      });

      expect(dispute).toBeDefined();
      expect(dispute.disputeNumber).toMatch(/^DSP-/);
      expect(dispute.status).toBe('OPEN');
      expect(dispute.claimAmountMinor).toBe(50000);
      disputeId = dispute.id;
    });

    it('artisan seller queries disputes and sees dispute for their sub-order', async () => {
      const list = await disputesService.listSellerDisputes(sellerProfile1.id, {
        page: 1,
        limit: 10,
      });
      expect(list.items.some((d) => d.id === disputeId)).toBe(true);

      const d = await disputesService.getSellerDispute(sellerProfile1.id, disputeId);
      expect(d.id).toBe(disputeId);
      expect(d.sellerId).toBe(sellerProfile1.id);
    });

    it('different artisan seller cannot access dispute belonging to another seller', async () => {
      await expect(disputesService.getSellerDispute(sellerProfile2.id, disputeId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('artisan seller submits dispute response and evidence notes', async () => {
      const updated = await disputesService.sellerRespond(sellerProfile1.id, disputeId, {
        sellerResponse:
          'The fabric border is hand-stitched selvedge, not a tear. Here is craft documentation.',
        evidenceUrls: ['https://storage.marketplace.internal/evidence/artisan-process.jpg'],
      });

      expect(updated.status).toBe('UNDER_REVIEW');
      expect(updated.sellerResponse).toContain('hand-stitched selvedge');
    });

    it('staff arbitrates dispute with refund and preserves double-entry financial ledger balance', async () => {
      const resolved = await disputesService.adminArbitrateDispute(staffUser.id, disputeId, {
        status: 'RESOLVED',
        resolutionNote: 'Customer accepted partial reimbursement of ₹500 for border alteration.',
        approvedRefundMinor: 50000,
      });

      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.refundAmountMinor).toBe(50000);
      expect(resolved.refundStatus).toBe('COMPLETED');
      expect(resolved.refundId).toBeDefined();

      // Verify reconciliation audit: no unbalanced batches
      const recon = await reconciliationService.runReconciliationAudit();
      expect(recon.unbalancedBatchesCount).toBe(0);

      // Verify double-entry ledger invariant on the dispute refund:
      // The refund batch must have equal sum of debits and credits
      const entries = await dbService.db
        .select()
        .from(dbService.schema.ledgerEntries)
        .where(eq(dbService.schema.ledgerEntries.subOrderId, testSubOrderId));

      let totalDebits = 0;
      let totalCredits = 0;
      for (const e of entries) {
        if (e.entryType === 'DEBIT') totalDebits += e.amountMinor;
        if (e.entryType === 'CREDIT') totalCredits += e.amountMinor;
      }
      expect(totalDebits).toBe(totalCredits);
    });
  });

  describe('3. Policy Violation Reports (Reports as Allegations, Moderation Takedown)', () => {
    let reportId: string;

    it('customer submits policy violation report against a product', async () => {
      const report = await policyViolationsService.submitReport(customerUser2.id, {
        targetType: 'PRODUCT',
        targetId: testProductId,
        reason: 'COUNTERFEIT_MASS_PRODUCED',
        details: 'Listing appears to use photos from factory catalog.',
        evidenceUrls: ['https://example.com/factory-photo.jpg'],
      });

      expect(report).toBeDefined();
      expect(report.status).toBe('PENDING');
      expect(report.targetType).toBe('PRODUCT');
      reportId = report.id;

      // Invariant: Product MUST remain APPROVED while report is pending (reports are allegations)
      const [product] = await dbService.db
        .select()
        .from(dbService.schema.products)
        .where(eq(dbService.schema.products.id, testProductId));
      expect(product.moderationStatus).toBe('APPROVED');
    });

    it('staff reviews policy report and dismisses report without delisting product', async () => {
      const reviewed = await policyViolationsService.adminReviewReport(staffUser.id, reportId, {
        status: 'DISMISSED',
        actionTaken: 'NONE',
        notes: 'Handmade certificate verified with guild.',
      });

      expect(reviewed.status).toBe('DISMISSED');
      expect(reviewed.actionTaken).toBe('NONE');

      const [product] = await dbService.db
        .select()
        .from(dbService.schema.products)
        .where(eq(dbService.schema.products.id, testProductId));
      expect(product.moderationStatus).toBe('APPROVED');
    });

    it('staff reviews another policy report with LISTING_REMOVED action and executes moderation takedown', async () => {
      // Submit second report
      const report2 = await policyViolationsService.submitReport(customerUser1.id, {
        targetType: 'PRODUCT',
        targetId: testProductId,
        reason: 'POLICY_VIOLATION',
        details: 'Verified duplicate copy of registered design.',
      });

      // Staff upholds report with action LISTING_REMOVED
      const reviewed2 = await policyViolationsService.adminReviewReport(staffUser.id, report2.id, {
        status: 'UPHELD',
        actionTaken: 'LISTING_REMOVED',
        notes: 'Confirmed infringement of artisan copyright.',
      });

      expect(reviewed2.status).toBe('UPHELD');
      expect(reviewed2.actionTaken).toBe('LISTING_REMOVED');

      // Product moderation status should now be REJECTED
      const [product] = await dbService.db
        .select()
        .from(dbService.schema.products)
        .where(eq(dbService.schema.products.id, testProductId));
      expect(product.moderationStatus).toBe('REJECTED');
    });
  });

  describe('4. Suspicious Activity & Human-Reviewed Risk Queue', () => {
    let riskCaseId: string;

    it('RBAC guard allows TRUST_SAFETY and SUPER_ADMIN roles, forbids CUSTOMER or SELLER', () => {
      const allowedRoles = ['SUPER_ADMIN', 'TRUST_SAFETY'];

      const staffCtx = createMockExecutionContext(['TRUST_SAFETY'], allowedRoles);
      expect(rolesGuard.canActivate(staffCtx)).toBe(true);

      const superAdminCtx = createMockExecutionContext(['SUPER_ADMIN'], allowedRoles);
      expect(rolesGuard.canActivate(superAdminCtx)).toBe(true);

      const customerCtx = createMockExecutionContext(['CUSTOMER'], allowedRoles);
      expect(rolesGuard.canActivate(customerCtx)).toBe(false);

      const sellerCtx = createMockExecutionContext(['SELLER'], allowedRoles);
      expect(rolesGuard.canActivate(sellerCtx)).toBe(false);
    });

    it('ingests a risk case for human review and confirms no automated ban occurred', async () => {
      const riskCase = await riskReviewService.createRiskCase({
        entityType: 'SELLER',
        entityId: sellerProfile1.id,
        signalType: 'SUSPICIOUS_PAYOUT_ACTIVITY',
        riskLevel: 'HIGH',
        score: 85,
        reasons: ['Multiple sudden bank account modification attempts within 1 hour'],
      });

      expect(riskCase).toBeDefined();
      expect(riskCase.caseNumber).toMatch(/^RSK-/);
      expect(riskCase.status).toBe('NEW');
      expect(riskCase.riskLevel).toBe('HIGH');
      riskCaseId = riskCase.id;

      // Invariant: Zero automated bans. Seller profile must remain APPROVED until human review
      const [seller] = await dbService.db
        .select()
        .from(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, sellerProfile1.id));
      expect(seller.verificationStatus).toBe('VERIFIED');
    });

    it('staff reviews risk case: assigns reviewer, updates risk level, sets action taken', async () => {
      const reviewed = await riskReviewService.adminReviewCase(staffUser.id, riskCaseId, {
        status: 'RESOLVED',
        riskLevel: 'MEDIUM',
        actionTaken: 'MONITORING',
        notes:
          'Contacted artisan by phone. Identity verified. Payouts left active with monitoring.',
        assignedToStaffId: staffUser.id,
      });

      expect(reviewed.status).toBe('RESOLVED');
      expect(reviewed.riskLevel).toBe('MEDIUM');
      expect(reviewed.actionTaken).toBe('MONITORING');
      expect(reviewed.assignedToStaffId).toBe(staffUser.id);
      expect(reviewed.reviewedByStaffId).toBe(staffUser.id);
    });
  });

  describe('5. Privacy & DPDP Compliance (Balancing Rule: Ledger Preservation vs PII Anonymization)', () => {
    let accessRequestId: string;
    let erasureRequestId: string;

    it('customer submits a data access request and staff exports user data bundle without secrets', async () => {
      const req = await privacyComplianceService.submitRequest(customerUser2.id, {
        requestType: 'DATA_ACCESS',
        details: 'Requesting export of my personal data under DPDP Act.',
      });

      expect(req.requestType).toBe('DATA_ACCESS');
      expect(req.status).toBe('PENDING');
      accessRequestId = req.id;

      const processed = await privacyComplianceService.adminProcessRequest(
        staffUser.id,
        accessRequestId,
        {
          status: 'COMPLETED',
          notes: 'Export bundle prepared and delivered.',
        },
      );

      expect(processed.status).toBe('COMPLETED');
      expect(processed.responseData).toBeDefined();
      expect(processed.responseData?.user).toBeDefined();
      expect(processed.responseData?.user.email).toBe(customerUser2.email);
      // Secrets must NEVER be leaked
      expect(
        (processed.responseData?.user as Record<string, unknown>)['passwordHash'],
      ).toBeUndefined();
    });

    it('customer submits account deletion and staff processes erasure with Balancing Rule', async () => {
      const req = await privacyComplianceService.submitRequest(customerUser1.id, {
        requestType: 'DATA_ERASURE',
        details: 'Please delete my account and personal data.',
      });

      expect(req.requestType).toBe('DATA_ERASURE');
      erasureRequestId = req.id;

      // Staff processes erasure
      const processed = await privacyComplianceService.adminProcessRequest(
        staffUser.id,
        erasureRequestId,
        {
          status: 'COMPLETED',
          notes:
            'PII anonymized, active sessions revoked, ledger & tax retained per Accounting Balancing Rule.',
        },
      );

      expect(processed.status).toBe('COMPLETED');

      // 1. Verify User PII was scrubbed
      const [user] = await dbService.db
        .select()
        .from(dbService.schema.users)
        .where(eq(dbService.schema.users.id, customerUser1.id));

      expect(user.email).toBe(`anonymized_${customerUser1.id}@deleted.marketplace.internal`);
      expect(user.phone).toBeNull();
      expect(user.firstName).toBe('Anonymized');
      expect(user.lastName).toBe('Customer');
      expect(user.passwordHash).toBe('ACCOUNT_DEACTIVATED_TOMBSTONE');

      // 2. Verify Statutory Retention Balancing Rule:
      // Transactional order and ledger records MUST remain completely intact for tax & audit compliance
      const [order] = await dbService.db
        .select()
        .from(dbService.schema.customerOrders)
        .where(eq(dbService.schema.customerOrders.id, testOrderId));
      expect(order).toBeDefined();
      expect(order.totalAmountMinor).toBe(220000);

      const [subOrder] = await dbService.db
        .select()
        .from(dbService.schema.subOrders)
        .where(eq(dbService.schema.subOrders.id, testSubOrderId));
      expect(subOrder).toBeDefined();
      expect(subOrder.netSellerPayableMinor).toBe(200000);

      const entries = await dbService.db
        .select()
        .from(dbService.schema.ledgerEntries)
        .where(eq(dbService.schema.ledgerEntries.subOrderId, testSubOrderId));
      expect(entries.length).toBeGreaterThan(0);
    });
  });
});

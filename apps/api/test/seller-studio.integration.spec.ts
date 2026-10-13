import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../src/modules/database/database.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { SellerOrdersService } from '../src/modules/sellers/seller-orders.service';
import { SellerStudioService } from '../src/modules/sellers/seller-studio.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('G10: Seller Studio, Business Management & Orders Integration', () => {
  let dbService: DatabaseService;
  let auditService: AuditService;
  let ordersService: SellerOrdersService;
  let studioService: SellerStudioService;

  // Test fixtures for Seller A
  let userAId: string;
  let sellerAId: string;
  let shopAId: string;
  let productAId: string;
  let variantAId: string;

  // Test fixtures for Seller B (Isolation checks)
  let userBId: string;
  let sellerBId: string;
  let shopBId: string;

  // Shared order fixture
  let customerId: string;
  let parentOrderId: string;
  let subOrderAId: string;
  let subOrderBId: string;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    auditService = new AuditService(dbService);
    ordersService = new SellerOrdersService(dbService, auditService);
    studioService = new SellerStudioService(dbService, auditService);

    // 1. Create Customer
    const [customer] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `customer.studio.${Date.now()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Ananya',
        lastName: 'Roy',
      })
      .returning();
    customerId = customer.id;

    // 2. Create Seller A
    const [userA] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.a.${Date.now()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Kabir',
        lastName: 'Woodcraft',
      })
      .returning();
    userAId = userA.id;

    const [sellerA] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: userAId,
        businessType: 'INDIVIDUAL',
        legalName: 'Kabir Handcrafted Woodcraft',
        verificationStatus: 'VERIFIED',
        commissionRateBps: 1000,
      })
      .returning();
    sellerAId = sellerA.id;

    const [shopA] = await dbService.db
      .insert(dbService.schema.shops)
      .values({
        sellerId: sellerAId,
        name: 'Kabir Teak Studio',
        slug: `kabir-teak-${Date.now()}`,
        description: 'Authentic Sheesham and Teak hand-carved tableware.',
        craftStory: 'Three generations of wood turning tradition in Saharanpur.',
      })
      .returning();
    shopAId = shopA.id;

    // Seller A initial balance
    await dbService.db.insert(dbService.schema.sellerBalances).values({
      sellerId: sellerAId,
      pendingEscrowMinor: 250000, // ₹2,500
      availablePayoutMinor: 100000, // ₹1,000
      heldDisputeMinor: 0,
      lifetimePayoutMinor: 500000,
      currency: 'INR',
    });

    // 3. Create Seller B
    const [userB] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.b.${Date.now()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Pooja',
        lastName: 'Pottery',
      })
      .returning();
    userBId = userB.id;

    const [sellerB] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: userBId,
        businessType: 'INDIVIDUAL',
        legalName: 'Pooja Terracotta Creations',
        verificationStatus: 'PENDING_REVIEW',
        commissionRateBps: 1000,
      })
      .returning();
    sellerBId = sellerB.id;

    const [shopB] = await dbService.db
      .insert(dbService.schema.shops)
      .values({
        sellerId: sellerBId,
        name: 'Pooja Terracotta Hub',
        slug: `pooja-terracotta-${Date.now()}`,
        description: 'Traditional earthen pots and bells.',
      })
      .returning();
    shopBId = shopB.id;

    // 4. Create Category & Products for Seller A
    const [category] = await dbService.db
      .select({ id: dbService.schema.categories.id })
      .from(dbService.schema.categories)
      .limit(1);

    const categoryId = category?.id || '00000000-0000-0000-0000-000000000001';

    const [prodA] = await dbService.db
      .insert(dbService.schema.products)
      .values({
        sellerId: sellerAId,
        categoryId,
        productType: 'READY_TO_SHIP',
        title: 'Hand-carved Teak Coaster Set (4 pcs)',
        slug: `teak-coaster-set-${Date.now()}`,
        description: 'Finely polished natural teak coasters.',
        basePriceMinor: 85000,
        currency: 'INR',
        moderationStatus: 'PUBLISHED',
        isActive: true,
      })
      .returning();
    productAId = prodA.id;

    const [variantA] = await dbService.db
      .insert(dbService.schema.productVariants)
      .values({
        productId: productAId,
        sku: `TEAK-CST-${Date.now().toString().slice(-4)}`,
        title: 'Standard Coaster Set',
        priceMinor: 85000,
        currency: 'INR',
        weightGrams: 300,
        dimensionLengthMm: 100,
        dimensionWidthMm: 100,
        dimensionHeightMm: 40,
        isActive: true,
      })
      .returning();
    variantAId = variantA.id;

    // Inventory for variant A: 3 units left (low stock!)
    await dbService.db.insert(dbService.schema.inventoryItems).values({
      variantId: variantAId,
      quantityOnHand: 3,
      quantityReserved: 0,
      lowStockThreshold: 5,
      isUnlimited: false,
    });

    // 5. Create Parent Order containing Sub-Order A and Sub-Order B (Multi-vendor order)
    const [parentOrder] = await dbService.db
      .insert(dbService.schema.customerOrders)
      .values({
        orderNumber: `ORD-G10-${Date.now().toString().slice(-6)}`,
        customerId,
        totalAmountMinor: 170000,
        currency: 'INR',
        paymentStatus: 'PAID',
        orderStatus: 'PROCESSING',
        shippingAddress: {
          recipientName: 'Ananya Roy',
          line1: 'Flat 402, Lotus Residency',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560034',
          country: 'IN',
          phone: '+919876543210',
        },
        billingAddress: {
          recipientName: 'Ananya Roy',
          line1: 'Flat 402, Lotus Residency',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560034',
          country: 'IN',
        },
        customerNote: 'Please pack carefully with ecofriendly wrap.',
      })
      .returning();
    parentOrderId = parentOrder.id;

    // Sub-order A (Seller A)
    const [subA] = await dbService.db
      .insert(dbService.schema.subOrders)
      .values({
        subOrderNumber: `SUB-A-${Date.now().toString().slice(-6)}`,
        parentOrderId,
        sellerId: sellerAId,
        shopId: shopAId,
        status: 'CONFIRMED',
        itemSubtotalMinor: 85000,
        shippingFeeMinor: 5000,
        commissionRateBps: 1000,
        commissionFeeMinor: 8500,
        taxMinor: 0,
        netSellerPayableMinor: 81500, // 85000 + 5000 - 8500 = 81500
        currency: 'INR',
      })
      .returning();
    subOrderAId = subA.id;

    // Order item for Sub-Order A
    await dbService.db.insert(dbService.schema.orderItems).values({
      subOrderId: subOrderAId,
      sellerId: sellerAId,
      variantId: variantAId,
      titleSnapshot: 'Hand-carved Teak Coaster Set (4 pcs)',
      skuSnapshot: 'TEAK-CST-STD',
      unitPriceMinor: 85000,
      quantity: 1,
      totalPriceMinor: 85000,
      customizationInput: 'Engrave "Roy Family" if possible',
    });

    // Sub-order B (Seller B)
    const [subB] = await dbService.db
      .insert(dbService.schema.subOrders)
      .values({
        subOrderNumber: `SUB-B-${Date.now().toString().slice(-6)}`,
        parentOrderId,
        sellerId: sellerBId,
        shopId: shopBId,
        status: 'CONFIRMED',
        itemSubtotalMinor: 75000,
        shippingFeeMinor: 5000,
        commissionRateBps: 1000,
        commissionFeeMinor: 7500,
        taxMinor: 0,
        netSellerPayableMinor: 72500,
        currency: 'INR',
      })
      .returning();
    subOrderBId = subB.id;
  });

  afterAll(async () => {
    // Cleanup fixtures
    if (subOrderAId) {
      await dbService.db
        .delete(dbService.schema.orderTimelineEvents)
        .where(
          inArray(dbService.schema.orderTimelineEvents.subOrderId, [subOrderAId, subOrderBId]),
        );
      await dbService.db
        .delete(dbService.schema.orderItems)
        .where(inArray(dbService.schema.orderItems.subOrderId, [subOrderAId, subOrderBId]));
      await dbService.db
        .delete(dbService.schema.subOrders)
        .where(inArray(dbService.schema.subOrders.id, [subOrderAId, subOrderBId]));
    }
    if (parentOrderId) {
      await dbService.db
        .delete(dbService.schema.customerOrders)
        .where(eq(dbService.schema.customerOrders.id, parentOrderId));
    }
    if (variantAId) {
      await dbService.db
        .delete(dbService.schema.inventoryItems)
        .where(eq(dbService.schema.inventoryItems.variantId, variantAId));
      await dbService.db
        .delete(dbService.schema.productVariants)
        .where(eq(dbService.schema.productVariants.id, variantAId));
    }
    if (productAId) {
      await dbService.db
        .delete(dbService.schema.products)
        .where(eq(dbService.schema.products.id, productAId));
    }
    if (sellerAId) {
      await dbService.db
        .delete(dbService.schema.sellerBalances)
        .where(eq(dbService.schema.sellerBalances.sellerId, sellerAId));
      await dbService.db
        .delete(dbService.schema.shops)
        .where(eq(dbService.schema.shops.id, shopAId));
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, sellerAId));
    }
    if (sellerBId) {
      await dbService.db
        .delete(dbService.schema.shops)
        .where(eq(dbService.schema.shops.id, shopBId));
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, sellerBId));
    }
    if (userAId || userBId || customerId) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(inArray(dbService.schema.users.id, [userAId, userBId, customerId]));
    }
  });

  // --- SELLER ORDERS SERVICE TESTS ---

  describe('SellerOrdersService - Multi-tenant Isolation & Management', () => {
    it('lists sub-orders belonging strictly to the authenticated seller', async () => {
      const result = await ordersService.listSellerOrders(userAId, {
        page: 1,
        limit: 10,
        status: 'ALL',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const foundA = result.items.find((item) => item.id === subOrderAId);
      expect(foundA).toBeDefined();
      expect(foundA?.netSellerPayableMinor).toBe(81500);

      // Verify strict isolation: Seller A must NOT see Sub-Order B from Seller B
      const foundB = result.items.find((item) => item.id === subOrderBId);
      expect(foundB).toBeUndefined();

      // Verify privacy redaction on summary list
      expect(foundA?.recipientCity).toBe('Bengaluru');
      expect(foundA?.recipientState).toBe('Karnataka');
    });

    it('filters seller sub-orders by status correctly', async () => {
      const confirmedList = await ordersService.listSellerOrders(userAId, {
        page: 1,
        limit: 10,
        status: 'CONFIRMED',
      });
      expect(confirmedList.items.some((i) => i.id === subOrderAId)).toBe(true);

      const shippedList = await ordersService.listSellerOrders(userAId, {
        page: 1,
        limit: 10,
        status: 'SHIPPED',
      });
      expect(shippedList.items.some((i) => i.id === subOrderAId)).toBe(false);
    });

    it('retrieves detailed sub-order with line items, buyer notes, and timeline', async () => {
      const detail = await ordersService.getSellerOrderDetail(userAId, subOrderAId);

      expect(detail.id).toBe(subOrderAId);
      expect(detail.parentPaymentStatus).toBe('PAID');
      expect(detail.customerNote).toBe('Please pack carefully with ecofriendly wrap.');
      expect(detail.items.length).toBe(1);
      expect(detail.items[0]?.titleSnapshot).toBe('Hand-carved Teak Coaster Set (4 pcs)');
      expect(detail.items[0]?.customizationInput).toBe('Engrave "Roy Family" if possible');
      expect(detail.shippingAddress.recipientName).toBe('Ananya Roy');
      expect(detail.shippingAddress.city).toBe('Bengaluru');
    });

    it('rejects access when seller attempts to inspect another seller sub-order (404/NotFound)', async () => {
      // Seller A attempts to view Sub-Order B belonging to Seller B
      await expect(ordersService.getSellerOrderDetail(userAId, subOrderBId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('transitions sub-order from CONFIRMED to IN_PRODUCTION and appends timeline event', async () => {
      const updated = await ordersService.updateSubOrderStatus(userAId, subOrderAId, {
        status: 'IN_PRODUCTION',
        notes: 'Teak wood cut and sanded; carving initial patterns.',
      });

      expect(updated.status).toBe('IN_PRODUCTION');
      expect(updated.timeline.length).toBeGreaterThanOrEqual(1);

      const latestEvent = updated.timeline[updated.timeline.length - 1];
      expect(latestEvent?.fromStatus).toBe('CONFIRMED');
      expect(latestEvent?.toStatus).toBe('IN_PRODUCTION');
      expect(latestEvent?.notes).toBe('Teak wood cut and sanded; carving initial patterns.');
    });

    it('transitions sub-order from IN_PRODUCTION to READY_FOR_PICKUP', async () => {
      const updated = await ordersService.updateSubOrderStatus(userAId, subOrderAId, {
        status: 'READY_FOR_PICKUP',
        notes: 'Coasters oiled with natural beeswax, boxed and labeled.',
      });

      expect(updated.status).toBe('READY_FOR_PICKUP');
      const latestEvent = updated.timeline[updated.timeline.length - 1];
      expect(latestEvent?.fromStatus).toBe('IN_PRODUCTION');
      expect(latestEvent?.toStatus).toBe('READY_FOR_PICKUP');
    });

    it('rejects invalid state machine transition and preserves current status', async () => {
      // Trying to transition from READY_FOR_PICKUP back to IN_PRODUCTION
      await expect(
        ordersService.updateSubOrderStatus(userAId, subOrderAId, {
          status: 'IN_PRODUCTION',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows permitted cancellation from CONFIRMED with required reason', async () => {
      // Test cancellation on Sub-Order B by Seller B
      const cancelled = await ordersService.updateSubOrderStatus(userBId, subOrderBId, {
        status: 'CANCELLED',
        cancellationReason: 'Workshop kiln heating element damaged',
      });

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Workshop kiln heating element damaged');
      expect(cancelled.cancelledAt).toBeDefined();
    });
  });

  // --- SELLER STUDIO SERVICE TESTS ---

  describe('SellerStudioService - Dashboard Overview, Analytics & Shop Settings', () => {
    it('produces authoritative dashboard overview with real seller metrics', async () => {
      const overview = await studioService.getDashboardOverview(userAId, { period: '7d' });

      // Metrics
      expect(overview.metrics.ordersCount).toBeGreaterThanOrEqual(1);
      expect(overview.metrics.grossSalesMinor).toBeGreaterThanOrEqual(90000); // 85000 + 5000
      expect(overview.metrics.netPayableMinor).toBeGreaterThanOrEqual(81500);
      expect(overview.metrics.publishedProductsCount).toBe(1);
      expect(overview.metrics.lowStockVariantsCount).toBe(1); // 3 units <= 5 threshold

      // Financial position from G09 ledger
      expect(overview.financialPosition.pendingEscrowMinor).toBe(250000);
      expect(overview.financialPosition.availablePayoutMinor).toBe(100000);
      expect(overview.financialPosition.currency).toBe('INR');

      // Action items
      expect(overview.actionItems.length).toBeGreaterThanOrEqual(1);
      const lowStockTask = overview.actionItems.find((t) => t.type === 'LOW_STOCK');
      expect(lowStockTask).toBeDefined();

      // Recent activity
      expect(overview.recentActivity.length).toBeGreaterThanOrEqual(1);
    });

    it('generates performance analytics with daily trends and top products', async () => {
      const analytics = await studioService.getPerformanceAnalytics(userAId, { period: '30d' });

      expect(analytics.period).toBe('30d');
      expect(analytics.summary.totalOrders).toBeGreaterThanOrEqual(1);
      expect(analytics.summary.grossSalesMinor).toBeGreaterThanOrEqual(90000);
      expect(analytics.summary.averageOrderValueMinor).toBeGreaterThan(0);
      expect(analytics.salesTrend.length).toBe(30);

      // Top products from order items
      expect(analytics.topProducts.length).toBeGreaterThanOrEqual(1);
      expect(analytics.topProducts[0]?.title).toBe('Hand-carved Teak Coaster Set (4 pcs)');
      expect(analytics.topProducts[0]?.unitsSold).toBe(1);
    });

    it('updates permitted shop profile settings and preserves verification integrity', async () => {
      const updated = await studioService.updateShopProfile(userAId, {
        description: 'Master craftsmen creating bespoke teak, rosewood, and sheesham tableware.',
        isVacationMode: true,
        vacationMessage: 'Artisan workshop closed for Diwali festivities until Nov 5.',
      });

      expect(updated.description).toBe(
        'Master craftsmen creating bespoke teak, rosewood, and sheesham tableware.',
      );
      expect(updated.isVacationMode).toBe(true);
      expect(updated.vacationMessage).toBe(
        'Artisan workshop closed for Diwali festivities until Nov 5.',
      );
      expect(updated.status).toBe('VERIFIED');
    });

    it('aggregates live actionable notifications for the seller', async () => {
      const notifs = await studioService.getNotifications(userAId);

      expect(Array.isArray(notifs)).toBe(true);
      // Low stock notification should be triggered for variant with 3 units
      const stockNotif = notifs.find((n) => n.type === 'STOCK');
      expect(stockNotif).toBeDefined();
    });

    it('throws ForbiddenException when an unprofiled user accesses the dashboard', async () => {
      await expect(
        studioService.getDashboardOverview(customerId, { period: '7d' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

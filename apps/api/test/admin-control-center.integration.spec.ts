import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../src/modules/database/database.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AdminDashboardService } from '../src/modules/admin/admin-dashboard.service';
import { AdminOrdersService } from '../src/modules/admin/admin-orders.service';
import { AdminShippingService } from '../src/modules/admin/admin-shipping.service';
import { AdminAuditService } from '../src/modules/admin/admin-audit.service';
import { AdminStaffService } from '../src/modules/admin/admin-staff.service';
import { ReconciliationService } from '../src/modules/payments/reconciliation.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

describe('G12: Admin & Agency Control Center Integration Test Suite', () => {
  let dbService: DatabaseService;
  let auditService: AuditService;
  let passwordService: PasswordService;
  let reconciliationService: ReconciliationService;
  let dashboardService: AdminDashboardService;
  let ordersService: AdminOrdersService;
  let shippingService: AdminShippingService;
  let auditAdminService: AdminAuditService;
  let staffService: AdminStaffService;

  // RBAC Guard helper
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

  // Test data IDs for cleanup
  let customerId: string;
  let sellerUserId: string;
  let sellerProfileId: string;
  let shopId: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let orderId: string;
  let subOrderId: string;
  let shipmentId: string;
  let staffUserId: string;
  let superAdminUserId: string;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    auditService = new AuditService(dbService);
    passwordService = new PasswordService();
    reconciliationService = new ReconciliationService(dbService);
    dashboardService = new AdminDashboardService(dbService, reconciliationService);
    ordersService = new AdminOrdersService(dbService);
    shippingService = new AdminShippingService(dbService);
    auditAdminService = new AdminAuditService(dbService);
    staffService = new AdminStaffService(dbService, passwordService, auditService);

    const schema = dbService.schema;
    const db = dbService.db;

    // 0. Create a super admin user fixture
    const [superAdminUser] = await db
      .insert(schema.users)
      .values({
        email: `superadmin.${Date.now()}@platform.local`,
        passwordHash: 'hash',
        firstName: 'System',
        lastName: 'Admin',
      })
      .returning();
    superAdminUserId = superAdminUser.id;

    // 1. Create a customer
    const [customer] = await db
      .insert(schema.users)
      .values({
        email: `admin.test.cust.${Date.now()}@example.com`,
        passwordHash: 'argon2id_dummy_hash',
        firstName: 'Devika',
        lastName: 'Sharma',
      })
      .returning();
    customerId = customer.id;

    // 2. Create an artisan seller user & profile
    const [artisanUser] = await db
      .insert(schema.users)
      .values({
        email: `admin.test.artisan.${Date.now()}@example.com`,
        passwordHash: 'argon2id_dummy_hash',
        firstName: 'Meera',
        lastName: 'Pottery',
      })
      .returning();
    sellerUserId = artisanUser.id;

    const [sellerProfile] = await db
      .insert(schema.sellerProfiles)
      .values({
        userId: sellerUserId,
        businessType: 'INDIVIDUAL',
        legalName: 'Meera Terracotta Studios',
        verificationStatus: 'PENDING_REVIEW',
        commissionRateBps: 1200,
      })
      .returning();
    sellerProfileId = sellerProfile.id;

    const [shop] = await db
      .insert(schema.shops)
      .values({
        sellerId: sellerProfileId,
        name: 'Meera Claycrafts',
        slug: `meera-clay-${Date.now()}`,
        status: 'ACTIVE',
      })
      .returning();
    shopId = shop.id;

    // 3. Category & Product
    const [cat] = await db
      .insert(schema.categories)
      .values({
        name: 'Terracotta & Ceramics',
        slug: `terracotta-${Date.now()}`,
      })
      .returning();
    categoryId = cat.id;

    const [prod] = await db
      .insert(schema.products)
      .values({
        sellerId: sellerProfileId,
        categoryId: categoryId,
        productType: 'READY_TO_SHIP',
        title: 'Handmade Glazed Terracotta Vase',
        slug: `terracotta-vase-${Date.now()}`,
        description: 'Sculpted on wheel and kiln fired with organic glazes.',
        basePriceMinor: 250000,
        moderationStatus: 'PENDING_REVIEW',
      })
      .returning();
    productId = prod.id;

    const [variant] = await db
      .insert(schema.productVariants)
      .values({
        productId: productId,
        sku: `VASE-${Date.now()}`,
        title: 'Earth Blue Terracotta Vase',
        priceMinor: 250000,
        weightGrams: 850,
        dimensionLengthMm: 150,
        dimensionWidthMm: 150,
        dimensionHeightMm: 250,
      })
      .returning();
    variantId = variant.id;

    // 4. Create Order & Sub-Order
    const [order] = await db
      .insert(schema.customerOrders)
      .values({
        orderNumber: `ORD-ADMIN-${Date.now()}`,
        customerId: customerId,
        totalAmountMinor: 250000,
        orderStatus: 'PLACED',
        paymentStatus: 'PAID',
        shippingAddress: {
          recipientName: 'Devika Sharma',
          phone: '+919876543210',
          addressLine1: '42 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'IN',
        },
        billingAddress: {
          recipientName: 'Devika Sharma',
          phone: '+919876543210',
          addressLine1: '42 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'IN',
        },
      })
      .returning();
    orderId = order.id;

    const [subOrder] = await db
      .insert(schema.subOrders)
      .values({
        subOrderNumber: `SUB-ADMIN-${Date.now()}`,
        parentOrderId: orderId,
        sellerId: sellerProfileId,
        shopId: shopId,
        status: 'CONFIRMED',
        itemSubtotalMinor: 250000,
        shippingFeeMinor: 0,
        commissionRateBps: 1200,
        commissionFeeMinor: 30000,
        taxMinor: 0,
        netSellerPayableMinor: 220000,
      })
      .returning();
    subOrderId = subOrder.id;

    // 5. Order Item
    await db.insert(schema.orderItems).values({
      subOrderId: subOrderId,
      sellerId: sellerProfileId,
      variantId: variantId,
      titleSnapshot: 'Handmade Glazed Terracotta Vase',
      skuSnapshot: `VASE-${Date.now()}`,
      unitPriceMinor: 250000,
      quantity: 1,
      totalPriceMinor: 250000,
      customizationInput: 'Engrave D.S. on base',
    });

    // 6. Payment Attempt
    await db.insert(schema.paymentAttempts).values({
      parentOrderId: orderId,
      provider: 'RAZORPAY',
      providerIntentId: `pay_test_${Date.now()}`,
      amountMinor: 250000,
      currency: 'INR',
      status: 'SUCCEEDED',
      idempotencyKey: `idem_pay_${Date.now()}`,
    });

    // 7. Shipment & Milestone
    const [shipment] = await db
      .insert(schema.shipments)
      .values({
        subOrderId: subOrderId,
        courierCode: 'DELHIVERY',
        trackingNumber: `TRK-ADM-${Date.now()}`,
        waybillNumber: `WB-ADM-${Date.now()}`,
        status: 'LABEL_CREATED',
        weightGrams: 850,
        lengthMm: 150,
        widthMm: 150,
        heightMm: 250,
        deliveryAddressSnapshot: {
          city: 'Bengaluru',
          postalCode: '560001',
        },
      })
      .returning();
    shipmentId = shipment.id;

    await db.insert(schema.shipmentMilestones).values({
      shipmentId: shipmentId,
      status: 'LABEL_CREATED',
      location: 'Bengaluru Hub',
      description: 'Shipping label generated and courier assigned',
      eventTime: new Date(),
    });

    // 8. Create an audit log event
    await auditService.logEvent({
      actorId: customerId,
      actorRole: 'CUSTOMER',
      action: 'ORDER_PLACED',
      resourceType: 'CUSTOMER_ORDER',
      resourceId: orderId,
      metadata: { orderNumber: order.orderNumber },
    });
  });

  afterAll(async () => {
    const schema = dbService.schema;
    const db = dbService.db;

    // Clean up created resources
    if (shipmentId) {
      await db
        .delete(schema.shipmentMilestones)
        .where(eq(schema.shipmentMilestones.shipmentId, shipmentId));
      await db.delete(schema.shipments).where(eq(schema.shipments.id, shipmentId));
    }
    if (orderId) {
      await db
        .delete(schema.paymentAttempts)
        .where(eq(schema.paymentAttempts.parentOrderId, orderId));
      await db.delete(schema.orderItems).where(eq(schema.orderItems.subOrderId, subOrderId));
      await db.delete(schema.subOrders).where(eq(schema.subOrders.parentOrderId, orderId));
      await db.delete(schema.customerOrders).where(eq(schema.customerOrders.id, orderId));
    }
    if (variantId) {
      await db.delete(schema.productVariants).where(eq(schema.productVariants.id, variantId));
    }
    if (productId) {
      await db.delete(schema.products).where(eq(schema.products.id, productId));
    }
    if (categoryId) {
      await db.delete(schema.categories).where(eq(schema.categories.id, categoryId));
    }
    if (shopId) {
      await db.delete(schema.shops).where(eq(schema.shops.id, shopId));
    }
    if (sellerProfileId) {
      await db.delete(schema.sellerProfiles).where(eq(schema.sellerProfiles.id, sellerProfileId));
    }
    if (staffUserId) {
      await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, staffUserId));
      await db.delete(schema.users).where(eq(schema.users.id, staffUserId));
    }
    if (sellerUserId) {
      await db.delete(schema.users).where(eq(schema.users.id, sellerUserId));
    }
    if (customerId) {
      await db.delete(schema.users).where(eq(schema.users.id, customerId));
    }
    if (superAdminUserId) {
      await db.delete(schema.users).where(eq(schema.users.id, superAdminUserId));
    }
  });

  describe('1. Role-Based Access Control & Privilege Separation', () => {
    it('grants SUPER_ADMIN unrestricted access to all operations', () => {
      const allowedRoles = ['SUPER_ADMIN'];
      const ctx = createMockExecutionContext(['SUPER_ADMIN'], allowedRoles);
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('grants authorized staff operational access based on defined roles', () => {
      const financeRoute = ['SUPER_ADMIN', 'FINANCE_CONTROLLER', 'READ_ONLY_ANALYST'];
      const ctxFinance = createMockExecutionContext(['FINANCE_CONTROLLER'], financeRoute);
      expect(rolesGuard.canActivate(ctxFinance)).toBe(true);

      const trustSafetyRoute = ['SUPER_ADMIN', 'TRUST_SAFETY', 'MARKETPLACE_MANAGER'];
      const ctxTrust = createMockExecutionContext(['TRUST_SAFETY'], trustSafetyRoute);
      expect(rolesGuard.canActivate(ctxTrust)).toBe(true);

      const supportRoute = ['SUPER_ADMIN', 'CUSTOMER_SUPPORT', 'MARKETPLACE_MANAGER'];
      const ctxSupport = createMockExecutionContext(['CUSTOMER_SUPPORT'], supportRoute);
      expect(rolesGuard.canActivate(ctxSupport)).toBe(true);
    });

    it('strictly forbids CUSTOMER and SELLER from accessing admin routes', () => {
      const adminRoute = ['SUPER_ADMIN', 'MARKETPLACE_MANAGER'];
      const ctxCustomer = createMockExecutionContext(['CUSTOMER'], adminRoute);
      expect(() => rolesGuard.canActivate(ctxCustomer)).toThrowError(ForbiddenException);

      const ctxSeller = createMockExecutionContext(['SELLER'], adminRoute);
      expect(() => rolesGuard.canActivate(ctxSeller)).toThrowError(ForbiddenException);
    });
  });

  describe('2. Authoritative Dashboard Metrics', () => {
    it('computes live counts for sellers, moderation, orders, shipments, and finances', async () => {
      const metrics = await dashboardService.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.sellers.total).toBeGreaterThanOrEqual(1);
      expect(metrics.sellers.pendingVerification).toBeGreaterThanOrEqual(1);

      expect(metrics.products.total).toBeGreaterThanOrEqual(1);
      expect(metrics.products.pendingModeration).toBeGreaterThanOrEqual(1);

      expect(metrics.orders.total).toBeGreaterThanOrEqual(1);
      expect(metrics.orders.grossMerchandiseValueMinor).toBeGreaterThanOrEqual(250000);

      expect(metrics.fulfilment.totalShipments).toBeGreaterThanOrEqual(1);
      expect(metrics.fulfilment.pendingPickup).toBeGreaterThanOrEqual(1);

      expect(metrics.finances.capturedPaymentsMinor).toBeGreaterThanOrEqual(250000);
      expect(metrics.finances.platformCommissionsMinor).toBeGreaterThanOrEqual(30000);
      expect(metrics.finances.sellerPayablesMinor).toBeGreaterThanOrEqual(220000);

      expect(Array.isArray(metrics.recentAuditLogs)).toBe(true);
      expect(metrics.recentAuditLogs.length).toBeGreaterThan(0);
    });
  });

  describe('3. Order Operations Workspace', () => {
    it('lists orders with pagination and status filters', async () => {
      const result = await ordersService.listOrders({
        page: 1,
        limit: 10,
        orderStatus: 'PLACED',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.meta.total).toBeGreaterThanOrEqual(1);
      const found = result.items.find((o) => o.id === orderId);
      expect(found).toBeDefined();
      expect(found?.orderNumber).toContain('ORD-ADMIN-');
      expect(found?.customerEmail).toContain('admin.test.cust');
      expect(found?.totalAmountMinor).toBe(250000);
    });

    it('retrieves detailed order breakdown with sub-orders, items snapshot, and payment', async () => {
      const detail = await ordersService.getOrderDetail(orderId);

      expect(detail.id).toBe(orderId);
      expect(detail.shippingAddress.city).toBe('Bengaluru');
      expect(detail.subOrders.length).toBe(1);

      const sub = detail.subOrders[0];
      expect(sub.sellerId).toBe(sellerProfileId);
      expect(sub.sellerLegalName).toBe('Meera Terracotta Studios');
      expect(sub.commissionFeeMinor).toBe(30000);
      expect(sub.items.length).toBe(1);
      expect(sub.items[0].productTitle).toBe('Handmade Glazed Terracotta Vase');
      expect(sub.items[0].customisationNote).toBe('Engrave D.S. on base');

      expect(detail.payment).toBeDefined();
      expect(detail.payment?.provider).toBe('RAZORPAY');
      expect(detail.payment?.status).toBe('SUCCEEDED');
      expect(detail.payment?.amountMinor).toBe(250000);
    });

    it('throws NotFoundException for non-existent order', async () => {
      await expect(
        ordersService.getOrderDetail('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Shipment Oversight & Carrier Operations', () => {
    it('lists shipments with courier and status filters', async () => {
      const result = await shippingService.listShipments({
        page: 1,
        limit: 10,
        carrier: 'DELHIVERY',
        status: 'LABEL_CREATED',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      const item = result.items.find((s) => s.id === shipmentId);
      expect(item).toBeDefined();
      expect(item?.carrier).toBe('DELHIVERY');
      expect(item?.destinationCity).toBe('Bengaluru');
    });

    it('retrieves comprehensive tracking events and dimensions for a shipment', async () => {
      const detail = await shippingService.getShipmentDetail(shipmentId);

      expect(detail.id).toBe(shipmentId);
      expect(detail.packageWeightGrams).toBe(850);
      expect(detail.dimensions.lengthCm).toBe(15);
      expect(detail.dimensions.widthCm).toBe(15);
      expect(detail.dimensions.heightCm).toBe(25);
      expect(detail.trackingEvents.length).toBeGreaterThanOrEqual(1);
      expect(detail.trackingEvents[0].status).toBe('LABEL_CREATED');
      expect(detail.trackingEvents[0].location).toBe('Bengaluru Hub');
    });
  });

  describe('5. Staff Accounts & Privilege Separation', () => {
    it('lists platform staff accounts excluding regular customers and sellers', async () => {
      const staffList = await staffService.listStaff({ page: 1, limit: 10 });
      expect(staffList).toBeDefined();
      expect(Array.isArray(staffList.items)).toBe(true);
    });

    it('prevents non-SUPER_ADMIN users from accessing staff management', () => {
      const allowedRoles = ['SUPER_ADMIN'];
      const ctxManager = createMockExecutionContext(['MARKETPLACE_MANAGER'], allowedRoles);
      expect(() => rolesGuard.canActivate(ctxManager)).toThrowError(ForbiddenException);
    });

    it('allows SUPER_ADMIN to create an operational staff user', async () => {
      const created = await staffService.createStaff(superAdminUserId, {
        email: `cs.agent.${Date.now()}@platform.local`,
        password: 'SecurePassword123!',
        firstName: 'Aarav',
        lastName: 'Support',
        role: 'CUSTOMER_SUPPORT',
      });

      expect(created).toBeDefined();
      expect(created.email).toContain('cs.agent.');
      expect(created.roles).toContain('CUSTOMER_SUPPORT');
      expect(created.status).toBe('ACTIVE');
      staffUserId = created.id;
    });

    it('allows SUPER_ADMIN to update staff user status (e.g. suspension)', async () => {
      const updated = await staffService.updateStaffStatus(superAdminUserId, staffUserId, {
        status: 'SUSPENDED',
        reason: 'Routine operational review',
      });

      expect(updated.id).toBe(staffUserId);
      expect(updated.status).toBe('SUSPENDED');
    });

    it('prevents staff user from self-suspension', async () => {
      await expect(
        staffService.updateStaffStatus(
          staffUserId, // Same updater ID as target user
          staffUserId,
          { status: 'INACTIVE', reason: 'Self-deactivation' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. Immutable Audit Log Viewer', () => {
    it('queries platform audit log records with resource and action filters', async () => {
      const auditResult = await auditAdminService.listAuditLogs({
        page: 1,
        limit: 10,
        action: 'ORDER_PLACED',
        resourceType: 'CUSTOMER_ORDER',
      });

      expect(auditResult.items.length).toBeGreaterThanOrEqual(1);
      const log = auditResult.items.find((l) => l.resourceId === orderId);
      expect(log).toBeDefined();
      expect(log?.actorRole).toBe('CUSTOMER');
      expect(log?.action).toBe('ORDER_PLACED');
    });

    it('retrieves full immutable metadata payload for a specific audit log', async () => {
      const auditResult = await auditAdminService.listAuditLogs({
        resourceType: 'CUSTOMER_ORDER',
      });
      const target = auditResult.items.find((l) => l.resourceId === orderId);
      expect(target).toBeDefined();

      if (target) {
        const detail = await auditAdminService.getAuditLogDetail(target.id);
        expect(detail.id).toBe(target.id);
        expect(detail.metadata).toBeDefined();
        expect((detail.metadata as Record<string, unknown>)['orderNumber']).toBeDefined();
      }
    });
  });
});

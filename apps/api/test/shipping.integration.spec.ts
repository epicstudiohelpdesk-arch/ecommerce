import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../src/modules/database/database.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ShippingService } from '../src/modules/shipping/shipping.service';
import { DelhiveryProvider } from '../src/modules/shipping/providers/delhivery.provider';
import { MockCourierProvider } from '../src/modules/shipping/providers/mock-courier.provider';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

describe('G11: Courier Integration, Shipping Operations & Fulfilment Integration', () => {
  let dbService: DatabaseService;
  let auditService: AuditService;
  let delhiveryProvider: DelhiveryProvider;
  let mockCourierProvider: MockCourierProvider;
  let shippingService: ShippingService;

  // Test fixtures for Seller A
  let userAId: string;
  let sellerAId: string;
  let shopAId: string;

  // Test fixtures for Seller B (Multi-tenant check)
  let userBId: string;
  let sellerBId: string;
  let shopBId: string;

  // Shared fixtures
  let customerId: string;
  let parentOrderId: string;
  let unpaidParentOrderId: string;
  let subOrderAId: string;
  let subOrderBId: string;
  let unpaidSubOrderAId: string;

  let bookedWaybill: string;
  let bookedTracking: string;

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    auditService = new AuditService(dbService);
    delhiveryProvider = new DelhiveryProvider();
    mockCourierProvider = new MockCourierProvider();
    shippingService = new ShippingService(
      dbService,
      auditService,
      delhiveryProvider,
      mockCourierProvider,
    );

    // 1. Create Customer
    const [customer] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `customer.shipping.${Date.now()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Devika',
        lastName: 'Sharma',
      })
      .returning();
    customerId = customer.id;

    // 2. Create Seller A with Pickup Address
    const [userA] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.shipping.a.${Date.now()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Raghav',
        lastName: 'Pottery',
      })
      .returning();
    userAId = userA.id;

    const [sellerA] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: userAId,
        businessType: 'INDIVIDUAL',
        legalName: 'Raghav Terracotta Crafts',
        verificationStatus: 'VERIFIED',
        commissionRateBps: 1000,
      })
      .returning();
    sellerAId = sellerA.id;

    const [shopA] = await dbService.db
      .insert(dbService.schema.shops)
      .values({
        sellerId: sellerAId,
        name: 'Raghav Terracotta',
        slug: `raghav-terracotta-${Date.now()}`,
        description: 'Traditional handcrafted terracotta ceramics and cookware.',
      })
      .returning();
    shopAId = shopA.id;

    await dbService.db.insert(dbService.schema.pickupAddresses).values({
      sellerId: sellerAId,
      contactName: 'Raghav Sharma',
      phone: '+91 98290 12345',
      addressLine1: 'Workshop 12, Kumbhar Wada',
      city: 'Jaipur',
      state: 'Rajasthan',
      postalCode: '302002',
      country: 'IN',
      isDefault: true,
    });

    // 3. Create Seller B (for tenant isolation)
    const [userB] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.shipping.b.${Date.now()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Meera',
        lastName: 'Textiles',
      })
      .returning();
    userBId = userB.id;

    const [sellerB] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: userBId,
        businessType: 'INDIVIDUAL',
        legalName: 'Meera Indigo Textiles',
        verificationStatus: 'VERIFIED',
        commissionRateBps: 1000,
      })
      .returning();
    sellerBId = sellerB.id;

    const [shopB] = await dbService.db
      .insert(dbService.schema.shops)
      .values({
        sellerId: sellerBId,
        name: 'Meera Indigo Studio',
        slug: `meera-indigo-${Date.now()}`,
        description: 'Authentic hand-blocked indigo dyed fabrics.',
      })
      .returning();
    shopBId = shopB.id;

    // 4. Create PAID Parent Order with shipping address
    const orderNumber = `ORD-SHIP-${Date.now().toString().slice(-6)}`;
    const [paidOrder] = await dbService.db
      .insert(dbService.schema.customerOrders)
      .values({
        customerId,
        orderNumber,
        orderStatus: 'PROCESSING',
        paymentStatus: 'PAID',
        itemSubtotalMinor: 500000,
        shippingFeeMinor: 15000,
        taxAmountMinor: 25000,
        platformFeeMinor: 0,
        totalAmountMinor: 540000,
        currency: 'INR',
        shippingAddress: {
          recipientName: 'Devika Sharma',
          phone: '+91 99887 76655',
          line1: 'Flat 402, Lotus Apartments',
          line2: 'Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400050',
          country: 'IN',
        },
        billingAddress: {
          recipientName: 'Devika Sharma',
          phone: '+91 99887 76655',
          line1: 'Flat 402, Lotus Apartments',
          line2: 'Bandra West',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400050',
          country: 'IN',
        },
      })
      .returning();
    parentOrderId = paidOrder.id;

    // 5. Create Sub-Orders under Paid Parent Order
    // SubOrder A belongs to Seller A and is in READY_FOR_PICKUP
    const [subA] = await dbService.db
      .insert(dbService.schema.subOrders)
      .values({
        parentOrderId,
        sellerId: sellerAId,
        shopId: shopAId,
        subOrderNumber: `SUB-SHIP-A-${Date.now().toString().slice(-6)}`,
        status: 'READY_FOR_PICKUP',
        itemSubtotalMinor: 300000,
        shippingFeeMinor: 10000,
        commissionRateBps: 1000,
        commissionFeeMinor: 30000,
        netSellerPayableMinor: 270000,
        currency: 'INR',
      })
      .returning();
    subOrderAId = subA.id;

    // SubOrder B belongs to Seller B and is in CONFIRMED
    const [subB] = await dbService.db
      .insert(dbService.schema.subOrders)
      .values({
        parentOrderId,
        sellerId: sellerBId,
        shopId: shopBId,
        subOrderNumber: `SUB-SHIP-B-${Date.now().toString().slice(-6)}`,
        status: 'CONFIRMED',
        itemSubtotalMinor: 200000,
        shippingFeeMinor: 5000,
        commissionRateBps: 1000,
        commissionFeeMinor: 20000,
        netSellerPayableMinor: 180000,
        currency: 'INR',
      })
      .returning();
    subOrderBId = subB.id;

    // 6. Create UNPAID Parent Order & SubOrder for eligibility tests
    const [unpaidOrder] = await dbService.db
      .insert(dbService.schema.customerOrders)
      .values({
        customerId,
        orderNumber: `ORD-UNPAID-${Date.now().toString().slice(-6)}`,
        orderStatus: 'PLACED',
        paymentStatus: 'PENDING',
        itemSubtotalMinor: 100000,
        shippingFeeMinor: 5000,
        taxAmountMinor: 5000,
        platformFeeMinor: 0,
        totalAmountMinor: 110000,
        currency: 'INR',
        shippingAddress: {
          recipientName: 'Unpaid Customer',
          phone: '+91 99999 88888',
          line1: '123 Test St',
          city: 'Delhi',
          state: 'Delhi',
          postalCode: '110001',
          country: 'IN',
        },
        billingAddress: {
          recipientName: 'Unpaid Customer',
          phone: '+91 99999 88888',
          line1: '123 Test St',
          city: 'Delhi',
          state: 'Delhi',
          postalCode: '110001',
          country: 'IN',
        },
      })
      .returning();
    unpaidParentOrderId = unpaidOrder.id;

    const [unpaidSub] = await dbService.db
      .insert(dbService.schema.subOrders)
      .values({
        parentOrderId: unpaidParentOrderId,
        sellerId: sellerAId,
        shopId: shopAId,
        subOrderNumber: `SUB-UNPAID-${Date.now().toString().slice(-6)}`,
        status: 'READY_FOR_PICKUP',
        itemSubtotalMinor: 100000,
        shippingFeeMinor: 5000,
        commissionRateBps: 1000,
        commissionFeeMinor: 10000,
        netSellerPayableMinor: 90000,
        currency: 'INR',
      })
      .returning();
    unpaidSubOrderAId = unpaidSub.id;
  });

  afterAll(async () => {
    // Cleanup records in reverse order
    if (subOrderAId) {
      const [sh] = await dbService.db
        .select()
        .from(dbService.schema.shipments)
        .where(eq(dbService.schema.shipments.subOrderId, subOrderAId));
      if (sh) {
        await dbService.db
          .delete(dbService.schema.shipmentMilestones)
          .where(eq(dbService.schema.shipmentMilestones.shipmentId, sh.id));
        await dbService.db
          .delete(dbService.schema.shipments)
          .where(eq(dbService.schema.shipments.id, sh.id));
      }
      await dbService.db
        .delete(dbService.schema.orderTimelineEvents)
        .where(eq(dbService.schema.orderTimelineEvents.subOrderId, subOrderAId));
      await dbService.db
        .delete(dbService.schema.subOrders)
        .where(eq(dbService.schema.subOrders.id, subOrderAId));
    }
    if (subOrderBId) {
      await dbService.db
        .delete(dbService.schema.subOrders)
        .where(eq(dbService.schema.subOrders.id, subOrderBId));
    }
    if (unpaidSubOrderAId) {
      await dbService.db
        .delete(dbService.schema.subOrders)
        .where(eq(dbService.schema.subOrders.id, unpaidSubOrderAId));
    }
    if (parentOrderId) {
      await dbService.db
        .delete(dbService.schema.customerOrders)
        .where(eq(dbService.schema.customerOrders.id, parentOrderId));
    }
    if (unpaidParentOrderId) {
      await dbService.db
        .delete(dbService.schema.customerOrders)
        .where(eq(dbService.schema.customerOrders.id, unpaidParentOrderId));
    }
    if (sellerAId) {
      await dbService.db
        .delete(dbService.schema.pickupAddresses)
        .where(eq(dbService.schema.pickupAddresses.sellerId, sellerAId));
      if (shopAId) {
        await dbService.db
          .delete(dbService.schema.shops)
          .where(eq(dbService.schema.shops.id, shopAId));
      }
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, sellerAId));
    }
    if (sellerBId) {
      if (shopBId) {
        await dbService.db
          .delete(dbService.schema.shops)
          .where(eq(dbService.schema.shops.id, shopBId));
      }
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, sellerBId));
    }
    if (userAId) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, userAId));
    }
    if (userBId) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, userBId));
    }
    if (customerId) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, customerId));
    }
  });

  describe('1. PIN Code Serviceability', () => {
    it('should verify delivery serviceability between valid Indian postal codes', async () => {
      const result = await shippingService.checkServiceability('302002', '400050', 'MOCK_COURIER');
      expect(result.serviceable).toBe(true);
      expect(result.originPostalCode).toBe('302002');
      expect(result.destinationPostalCode).toBe('400050');
      expect(result.carrierCode).toBe('MOCK_COURIER');
      expect(result.estimatedDeliveryDays).toBeGreaterThan(0);
    });

    it('should mark invalid / non-serviceable remote PIN codes as unserviceable', async () => {
      const result = await shippingService.checkServiceability('302002', '999999', 'MOCK_COURIER');
      expect(result.serviceable).toBe(false);
    });
  });

  describe('2. Fulfilment Eligibility & Multi-Tenant Isolation', () => {
    it('should reject booking shipment for an unpaid order', async () => {
      await expect(
        shippingService.bookShipment(userAId, unpaidSubOrderAId, {
          packageWeightGrams: 850,
          packageDimensionsMm: { length: 200, width: 150, height: 100 },
          pickupDate: new Date().toISOString().split('T')[0]!,
          carrierCode: 'MOCK_COURIER',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject booking shipment when sub-order is not in READY_FOR_PICKUP (e.g. CONFIRMED)', async () => {
      await expect(
        shippingService.bookShipment(userBId, subOrderBId, {
          packageWeightGrams: 500,
          packageDimensionsMm: { length: 150, width: 120, height: 80 },
          pickupDate: new Date().toISOString().split('T')[0]!,
          carrierCode: 'MOCK_COURIER',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should strictly prevent Seller B from booking a shipment for Seller A sub-order', async () => {
      await expect(
        shippingService.bookShipment(userBId, subOrderAId, {
          packageWeightGrams: 850,
          packageDimensionsMm: { length: 200, width: 150, height: 100 },
          pickupDate: new Date().toISOString().split('T')[0]!,
          carrierCode: 'MOCK_COURIER',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('3. Shipment Booking & Waybill Generation', () => {
    it('should successfully book a courier shipment and generate AWB for eligible sub-order', async () => {
      const pickupDateStr = new Date().toISOString().split('T')[0]!;
      const result = await shippingService.bookShipment(userAId, subOrderAId, {
        packageWeightGrams: 850,
        packageDimensionsMm: { length: 220, width: 160, height: 120 },
        pickupDate: pickupDateStr,
        carrierCode: 'MOCK_COURIER',
        notes: 'Handcrafted terracotta pottery - handle with care',
      });

      expect(result.shipmentId).toBeDefined();
      expect(result.subOrderId).toBe(subOrderAId);
      expect(result.carrierCode).toBe('MOCK_COURIER');
      expect(result.waybillNumber).toMatch(/^MCK\d+/);
      expect(result.trackingNumber).toMatch(/^TRK-MCK-\d+/);
      expect(result.status).toBe('LABEL_CREATED');
      expect(result.labelUrl).toContain(result.waybillNumber);

      bookedWaybill = result.waybillNumber;
      bookedTracking = result.trackingNumber;

      // Verify database record
      const [dbShipment] = await dbService.db
        .select()
        .from(dbService.schema.shipments)
        .where(eq(dbService.schema.shipments.id, result.shipmentId))
        .limit(1);

      expect(dbShipment).toBeDefined();
      expect(dbShipment.status).toBe('LABEL_CREATED');
      expect(dbShipment.weightGrams).toBe(850);
      expect(dbShipment.lengthMm).toBe(220);
      expect(dbShipment.pickupAddressSnapshot).toBeDefined();
      expect(dbShipment.deliveryAddressSnapshot).toBeDefined();

      // Verify initial milestone
      const milestones = await dbService.db
        .select()
        .from(dbService.schema.shipmentMilestones)
        .where(eq(dbService.schema.shipmentMilestones.shipmentId, result.shipmentId));

      expect(milestones.length).toBeGreaterThanOrEqual(1);
      expect(milestones[0]!.status).toBe('LABEL_CREATED');
    });

    it('should reject duplicate booking on an already booked sub-order (Idempotency)', async () => {
      const pickupDateStr = new Date().toISOString().split('T')[0]!;
      await expect(
        shippingService.bookShipment(userAId, subOrderAId, {
          packageWeightGrams: 850,
          packageDimensionsMm: { length: 220, width: 160, height: 120 },
          pickupDate: pickupDateStr,
          carrierCode: 'MOCK_COURIER',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('4. Shipping Label Generation & Access Control', () => {
    it('should generate printable shipping label HTML with barcode, consignor, and consignee', async () => {
      const label = await shippingService.getShippingLabel(userAId, subOrderAId);

      expect(label.shipmentId).toBeDefined();
      expect(label.waybillNumber).toBe(bookedWaybill);
      expect(label.carrierCode).toBe('MOCK_COURIER');
      expect(label.contentHtml).toBeDefined();
      expect(label.contentHtml).toContain('AWB:');
      expect(label.contentHtml).toContain(bookedWaybill);
      expect(label.contentHtml).toContain('Devika Sharma'); // Customer recipient
      expect(label.contentHtml).toContain('400050'); // Recipient PIN
      expect(label.contentHtml).toContain('Jaipur'); // Artisan Origin
      expect(label.contentHtml).toContain('850g'); // Dead weight
    });

    it('should reject unauthorized seller attempting to access another seller shipping label', async () => {
      await expect(shippingService.getShippingLabel(userBId, subOrderAId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('5. Courier Pickup Scheduling', () => {
    it('should successfully schedule a courier pickup slot', async () => {
      const pickupDateStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]!;
      const result = await shippingService.schedulePickup(userAId, subOrderAId, {
        pickupDate: pickupDateStr,
        timeSlot: '11:00 - 14:00',
        notes: 'Ring bell at workshop gate',
      });

      expect(result.pickupScheduled).toBe(true);
      expect(result.status).toBe('PICKUP_SCHEDULED');
      expect(result.pickupToken).toBeDefined();
      expect(result.pickupDate).toBe(pickupDateStr);

      // Verify database updated
      const shipment = await shippingService.getSellerShipment(userAId, subOrderAId);
      expect(shipment.status).toBe('PICKUP_SCHEDULED');
      expect(shipment.milestones?.some((m) => m.status === 'PICKUP_SCHEDULED')).toBe(true);
    });
  });

  describe('6. Tracking Webhook & Order State Synchronization', () => {
    it('should reject webhook with missing or invalid cryptographic HMAC signature', async () => {
      const payload = {
        provider: 'MOCK_COURIER' as const,
        waybillNumber: bookedWaybill,
        status: 'IN_TRANSIT',
        location: 'Jaipur Sorting Facility',
        description: 'Package picked up from artisan workshop',
      };

      await expect(
        shippingService.processTrackingWebhook(
          'MOCK_COURIER',
          JSON.stringify(payload),
          'invalid-forged-signature',
          payload,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should ingest pickup scan webhook, transitioning shipment to IN_TRANSIT and sub-order to SHIPPED', async () => {
      const payload = {
        provider: 'MOCK_COURIER' as const,
        waybillNumber: bookedWaybill,
        status: 'IN_TRANSIT',
        location: 'Jaipur Air Logistics Center',
        description: 'Parcel scanned and in transit',
        eventTime: new Date().toISOString(),
      };

      const rawBody = JSON.stringify(payload);
      const validSignature = mockCourierProvider.signPayload(rawBody);

      const res = await shippingService.processTrackingWebhook(
        'MOCK_COURIER',
        rawBody,
        validSignature,
        payload,
      );

      expect(res.processed).toBe(true);
      expect(res.status).toBe('IN_TRANSIT');

      // Verify sub-order transitioned to SHIPPED
      const [updatedSubOrder] = await dbService.db
        .select()
        .from(dbService.schema.subOrders)
        .where(eq(dbService.schema.subOrders.id, subOrderAId))
        .limit(1);

      expect(updatedSubOrder.status).toBe('SHIPPED');

      // Verify parent order transitioned to PARTIALLY_SHIPPED (because subOrderB is still CONFIRMED)
      const [updatedParentOrder] = await dbService.db
        .select()
        .from(dbService.schema.customerOrders)
        .where(eq(dbService.schema.customerOrders.id, parentOrderId))
        .limit(1);

      expect(updatedParentOrder.orderStatus).toBe('PARTIALLY_SHIPPED');
    });

    it('should ingest delivery scan webhook, transitioning shipment to DELIVERED and sub-order to DELIVERED', async () => {
      const payload = {
        provider: 'MOCK_COURIER' as const,
        waybillNumber: bookedWaybill,
        status: 'DELIVERED',
        location: 'Mumbai Hub',
        description: 'Parcel delivered safely to consignee Devika Sharma',
        eventTime: new Date().toISOString(),
      };

      const rawBody = JSON.stringify(payload);
      const validSignature = mockCourierProvider.signPayload(rawBody);

      const res = await shippingService.processTrackingWebhook(
        'MOCK_COURIER',
        rawBody,
        validSignature,
        payload,
      );

      expect(res.processed).toBe(true);
      expect(res.status).toBe('DELIVERED');

      // Verify sub-order transitioned to DELIVERED
      const [updatedSubOrder] = await dbService.db
        .select()
        .from(dbService.schema.subOrders)
        .where(eq(dbService.schema.subOrders.id, subOrderAId))
        .limit(1);

      expect(updatedSubOrder.status).toBe('DELIVERED');
      expect(updatedSubOrder.completedAt).toBeDefined();
    });

    it('should ignore out-of-order regressive status webhooks once DELIVERED', async () => {
      // If courier sends late 'IN_TRANSIT' after DELIVERED, do not revert status
      const payload = {
        provider: 'MOCK_COURIER' as const,
        waybillNumber: bookedWaybill,
        status: 'IN_TRANSIT',
        location: 'Old Scan Station',
        description: 'Delayed scan packet',
        eventTime: new Date().toISOString(),
      };

      const rawBody = JSON.stringify(payload);
      const validSignature = mockCourierProvider.signPayload(rawBody);

      const res = await shippingService.processTrackingWebhook(
        'MOCK_COURIER',
        rawBody,
        validSignature,
        payload,
      );

      expect(res.processed).toBe(true);

      const shipment = await shippingService.getSellerShipment(userAId, subOrderAId);
      expect(shipment.status).toBe('DELIVERED'); // Kept at DELIVERED
    });
  });

  describe('7. Customer Order Tracking & Public Tracking', () => {
    it('should provide comprehensive, redacted customer tracking for order', async () => {
      const [parent] = await dbService.db
        .select()
        .from(dbService.schema.customerOrders)
        .where(eq(dbService.schema.customerOrders.id, parentOrderId))
        .limit(1);

      const tracking = await shippingService.getCustomerOrderTracking(parent.orderNumber);

      expect(tracking.orderNumber).toBe(parent.orderNumber);
      expect(tracking.shipments.length).toBeGreaterThanOrEqual(1);

      const sh = tracking.shipments[0]!;
      expect(sh.carrier).toBe('MOCK_COURIER');
      expect(sh.status).toBe('DELIVERED');
      expect(sh.sellerShopName).toBe('Raghav Terracotta');
      expect(sh.checkpoints.length).toBeGreaterThanOrEqual(3);
      expect(sh.checkpoints.some((c) => c.status === 'DELIVERED')).toBe(true);
    });

    it('should provide public tracking by tracking number without leaking customer PII', async () => {
      const publicTrack = await shippingService.getPublicTracking(bookedTracking);

      expect(publicTrack.trackingNumber).toBe(bookedTracking);
      expect(publicTrack.waybillNumber).toBe(bookedWaybill);
      expect(publicTrack.status).toBe('DELIVERED');
      expect(publicTrack.checkpoints.length).toBeGreaterThan(0);
      // Ensure no raw address objects are exposed
      expect((publicTrack as Record<string, unknown>)['shippingAddress']).toBeUndefined();
      expect((publicTrack as Record<string, unknown>)['recipientPhone']).toBeUndefined();
    });
  });

  describe('8. Shipment Cancellation Safeguards', () => {
    it('should prevent cancellation once shipment has already been delivered', async () => {
      await expect(
        shippingService.cancelShipment(userAId, subOrderAId, {
          reason: 'Customer requested change of address',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

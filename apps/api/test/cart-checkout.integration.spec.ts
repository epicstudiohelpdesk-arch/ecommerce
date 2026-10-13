import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../src/modules/database/database.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { InventoryService } from '../src/modules/catalog/inventory.service';
import { CartService } from '../src/modules/cart/cart.service';
import { PricingService } from '../src/modules/checkout/pricing.service';
import { AddressService } from '../src/modules/checkout/address.service';
import { CheckoutService } from '../src/modules/checkout/checkout.service';
import { CategoriesService } from '../src/modules/catalog/categories.service';

describe('G08: Shopping Cart, Checkout & Order Creation Foundation Integration', () => {
  let dbService: DatabaseService;
  let auditService: AuditService;
  let inventoryService: InventoryService;
  let cartService: CartService;
  let pricingService: PricingService;
  let addressService: AddressService;
  let checkoutService: CheckoutService;
  let categoriesService: CategoriesService;

  const uniqueSuffix = `${Date.now()}-cart-${Math.random().toString(36).substring(2, 7)}`;

  // Test Entities
  let customerUser: { id: string; email: string };
  let sellerAProfileId: string;
  let shopAId: string;
  let sellerBProfileId: string;
  let shopBId: string;

  let categoryId: string;
  let productAId: string;
  let variantAId: string;
  let productBId: string;
  let variantBId: string;

  let testCouponId: string;
  const couponCode = `FESTIVE10_${uniqueSuffix}`.toUpperCase();

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    auditService = new AuditService(dbService);
    inventoryService = new InventoryService(dbService, auditService);
    cartService = new CartService(dbService, auditService);
    pricingService = new PricingService(dbService);
    addressService = new AddressService(dbService);
    checkoutService = new CheckoutService(
      dbService,
      auditService,
      cartService,
      inventoryService,
      pricingService,
      addressService,
    );
    categoriesService = new CategoriesService(dbService);

    // Fetch existing category
    const categories = await categoriesService.listCategories();
    expect(categories.length).toBeGreaterThan(0);
    categoryId = categories[0]!.id;

    // 1. Create Verified Customer
    const [cUser] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `customer.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Meera',
        lastName: 'Nair',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();
    customerUser = cUser!;

    // 2. Create Verified Artisan Seller A (Pottery Studio)
    const [sUserA] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.a.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Ananya',
        lastName: 'Roy',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();

    const [sProfileA] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: sUserA!.id,
        legalName: 'Ananya Clay Creations LLP',
        businessType: 'REGISTERED_COMPANY',
        taxId: '29ABCDE1234F1Z5',
        verificationStatus: 'VERIFIED',
        commissionRateBps: 1000, // 10%
        termsAcceptedVersion: '1.0',
        termsAcceptedAt: new Date(),
        verifiedAt: new Date(),
      })
      .returning();
    sellerAProfileId = sProfileA!.id;

    const [shopA] = await dbService.db
      .insert(dbService.schema.shops)
      .values({
        sellerId: sellerAProfileId,
        name: 'Terracotta Artisans',
        slug: `terracotta-${uniqueSuffix}`,
        description: 'Authentic clay and terracotta pottery',
      })
      .returning();
    shopAId = shopA!.id;

    // 3. Create Verified Artisan Seller B (Woodcraft Studio)
    const [sUserB] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email: `artisan.b.${uniqueSuffix}@example.test`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$insecure',
        firstName: 'Rajesh',
        lastName: 'Sharma',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .returning();

    const [sProfileB] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: sUserB!.id,
        legalName: 'Sharma Heritage Woodcrafts',
        businessType: 'INDIVIDUAL',
        taxId: '27XYZAB5678C1Z2',
        verificationStatus: 'VERIFIED',
        commissionRateBps: 1200, // 12%
        termsAcceptedVersion: '1.0',
        termsAcceptedAt: new Date(),
        verifiedAt: new Date(),
      })
      .returning();
    sellerBProfileId = sProfileB!.id;

    const [shopB] = await dbService.db
      .insert(dbService.schema.shops)
      .values({
        sellerId: sellerBProfileId,
        name: 'Teak & Cedar Studio',
        slug: `teak-cedar-${uniqueSuffix}`,
        description: 'Hand-carved sustainable teak tableware',
      })
      .returning();
    shopBId = shopB!.id;

    // 4. Create Product A (Pottery Vase - ₹850.00 = 85000 paise)
    const [prodA] = await dbService.db
      .insert(dbService.schema.products)
      .values({
        sellerId: sellerAProfileId,
        categoryId,
        productType: 'READY_TO_SHIP',
        title: 'Handcrafted Terracotta Vase',
        slug: `terracotta-vase-${uniqueSuffix}`,
        description: 'Unglazed red terracotta vase made on traditional potter wheel',
        basePriceMinor: 85000,
        currency: 'INR',
        moderationStatus: 'PUBLISHED',
        publishedAt: new Date(),
        isActive: true,
      })
      .returning();
    productAId = prodA!.id;

    const [varA] = await dbService.db
      .insert(dbService.schema.productVariants)
      .values({
        productId: productAId,
        sku: `VASE-TERRA-${uniqueSuffix}`,
        title: 'Standard Earth Red',
        priceMinor: 85000,
        currency: 'INR',
        weightGrams: 900,
        dimensionLengthMm: 150,
        dimensionWidthMm: 150,
        dimensionHeightMm: 220,
        isActive: true,
      })
      .returning();
    variantAId = varA!.id;

    await dbService.db.insert(dbService.schema.inventoryItems).values({
      variantId: variantAId,
      quantityOnHand: 10,
      quantityReserved: 0,
      isUnlimited: false,
    });

    // 5. Create Product B (Carved Wooden Bowl - ₹1,400.00 = 140000 paise)
    const [prodB] = await dbService.db
      .insert(dbService.schema.products)
      .values({
        sellerId: sellerBProfileId,
        categoryId,
        productType: 'READY_TO_SHIP',
        title: 'Hand-Carved Teak Salad Bowl',
        slug: `teak-salad-bowl-${uniqueSuffix}`,
        description: 'Single-piece reclaimed teak wood with organic food-safe oil finish',
        basePriceMinor: 140000,
        currency: 'INR',
        moderationStatus: 'PUBLISHED',
        publishedAt: new Date(),
        isActive: true,
      })
      .returning();
    productBId = prodB!.id;

    const [varB] = await dbService.db
      .insert(dbService.schema.productVariants)
      .values({
        productId: productBId,
        sku: `BOWL-TEAK-${uniqueSuffix}`,
        title: 'Medium 10-inch',
        priceMinor: 140000,
        currency: 'INR',
        weightGrams: 650,
        dimensionLengthMm: 250,
        dimensionWidthMm: 250,
        dimensionHeightMm: 80,
        isActive: true,
      })
      .returning();
    variantBId = varB!.id;

    await dbService.db.insert(dbService.schema.inventoryItems).values({
      variantId: variantBId,
      quantityOnHand: 8,
      quantityReserved: 0,
      isUnlimited: false,
    });

    // 6. Create Test Platform Coupon (10% off for orders over ₹1,000)
    const [coupon] = await dbService.db
      .insert(dbService.schema.coupons)
      .values({
        code: couponCode,
        discountType: 'PERCENTAGE',
        discountValue: 1000, // 10.00% = 1000 bps
        minOrderMinor: 100000, // min ₹1,000 order
        maxDiscountMinor: 30000, // max ₹300 discount
        fundedBy: 'PLATFORM',
        startsAt: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 86400000),
        isActive: true,
      })
      .returning();
    testCouponId = coupon!.id;
  });

  afterAll(async () => {
    // Cleanup generated test data in referential integrity order
    if (dbService?.db) {
      if (testCouponId) {
        await dbService.db
          .delete(dbService.schema.coupons)
          .where(eq(dbService.schema.coupons.id, testCouponId));
      }
      if (customerUser?.id) {
        // Cascade delete will delete sub_orders and order_items
        await dbService.db
          .delete(dbService.schema.customerOrders)
          .where(eq(dbService.schema.customerOrders.customerId, customerUser.id));
        await dbService.db
          .delete(dbService.schema.customerAddresses)
          .where(eq(dbService.schema.customerAddresses.customerId, customerUser.id));
      }
      if (variantAId || variantBId) {
        await dbService.db
          .delete(dbService.schema.inventoryReservations)
          .where(
            inArray(dbService.schema.inventoryReservations.variantId, [variantAId, variantBId]),
          );
        await dbService.db
          .delete(dbService.schema.stockAdjustments)
          .where(inArray(dbService.schema.stockAdjustments.variantId, [variantAId, variantBId]));
        await dbService.db
          .delete(dbService.schema.inventoryItems)
          .where(inArray(dbService.schema.inventoryItems.variantId, [variantAId, variantBId]));
        await dbService.db
          .delete(dbService.schema.productVariants)
          .where(inArray(dbService.schema.productVariants.id, [variantAId, variantBId]));
      }
      if (productAId || productBId) {
        await dbService.db
          .delete(dbService.schema.products)
          .where(inArray(dbService.schema.products.id, [productAId, productBId]));
      }
      if (shopAId || shopBId) {
        await dbService.db
          .delete(dbService.schema.shops)
          .where(inArray(dbService.schema.shops.id, [shopAId, shopBId]));
      }
      if (sellerAProfileId || sellerBProfileId) {
        await dbService.db
          .delete(dbService.schema.sellerProfiles)
          .where(inArray(dbService.schema.sellerProfiles.id, [sellerAProfileId, sellerBProfileId]));
      }
      if (customerUser?.id) {
        await dbService.db
          .delete(dbService.schema.users)
          .where(eq(dbService.schema.users.id, customerUser.id));
      }
    }
  });

  describe('1. Shopping Cart Management & Multi-Vendor Grouping', () => {
    const guestSessionId = `test_guest_session_${Date.now()}`;

    it('creates an empty guest cart on first access', async () => {
      const cart = await cartService.getCart({ sessionId: guestSessionId });
      expect(cart).toBeDefined();
      expect(cart.itemsCount).toBe(0);
      expect(cart.subtotalMinor).toBe(0);
      expect(cart.sellerGroups).toHaveLength(0);
    });

    it('adds items from multiple artisan workshops and partitions into seller groups', async () => {
      // Add 1 Terracotta Vase from Seller A (₹850.00 = 85000 paise)
      const cartWithItemA = await cartService.addItem(
        { sessionId: guestSessionId },
        { variantId: variantAId, quantity: 1, customizationText: 'Initials AR' },
      );

      expect(cartWithItemA.itemsCount).toBe(1);
      expect(cartWithItemA.sellerGroups).toHaveLength(1);
      expect(cartWithItemA.sellerGroups[0]!.sellerId).toBe(sellerAProfileId);
      expect(cartWithItemA.sellerGroups[0]!.subtotalMinor).toBe(85000);
      // Below ₹1,000 threshold -> shipping fee is 5000 paise (₹50)
      expect(cartWithItemA.sellerGroups[0]!.shippingFeeMinor).toBe(5000);

      // Add 2 Teak Bowls from Seller B (2 * ₹1,400.00 = 280000 paise)
      const cartWithBoth = await cartService.addItem(
        { sessionId: guestSessionId },
        { variantId: variantBId, quantity: 2 },
      );

      expect(cartWithBoth.itemsCount).toBe(3);
      expect(cartWithBoth.sellerGroups).toHaveLength(2);

      // Check Seller B group
      const sellerBGroup = cartWithBoth.sellerGroups.find((g) => g.sellerId === sellerBProfileId);
      expect(sellerBGroup).toBeDefined();
      expect(sellerBGroup!.items).toHaveLength(1);
      expect(sellerBGroup!.subtotalMinor).toBe(280000);
      // Exceeds ₹1,000 threshold -> FREE shipping (0 paise)
      expect(sellerBGroup!.shippingFeeMinor).toBe(0);

      // Total estimated calculation: 85000 + 280000 + 5000 + 0 = 370000 paise
      expect(cartWithBoth.subtotalMinor).toBe(365000);
      expect(cartWithBoth.estimatedShippingMinor).toBe(5000);
      expect(cartWithBoth.totalEstimatedMinor).toBe(370000);
    });

    it('enforces maximum quantity limit (50) per cart item', async () => {
      await expect(
        cartService.addItem({ sessionId: guestSessionId }, { variantId: variantAId, quantity: 60 }),
      ).rejects.toThrow(/Maximum quantity per cart item is 50/);
    });

    it('merges guest cart items into customer cart on login with deduplication', async () => {
      // 1. Add item to customer cart beforehand
      await cartService.addItem(
        { customerId: customerUser.id },
        { variantId: variantAId, quantity: 1 },
      );

      // 2. Merge guest cart (which has 1 Vase and 2 Bowls) into customer cart
      const mergedCart = await cartService.mergeCart(customerUser.id, guestSessionId);

      expect(mergedCart.customerId).toBe(customerUser.id);
      expect(mergedCart.itemsCount).toBe(4); // 2 vases (deduplicated 1 + 1) + 2 bowls

      const groupA = mergedCart.sellerGroups.find((g) => g.sellerId === sellerAProfileId);
      expect(groupA).toBeDefined();
      expect(groupA!.items[0]!.quantity).toBe(2);
    });
  });

  describe('2. Saved Delivery Addresses & Strict Validation', () => {
    let createdAddressId: string;

    it('creates customer delivery address with valid Indian PIN code and mobile', async () => {
      const address = await addressService.createAddress(customerUser.id, {
        recipientName: 'Meera Nair',
        phone: '9876543210',
        addressLine1: 'Flat 402, Lotus Residency, 14th Main Road',
        addressLine2: 'Near Indiranagar Club',
        locality: 'HAL 2nd Stage',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560038',
        country: 'IN',
        deliveryInstructions: 'Fragile handcrafted ceramic items, please handle with care',
        isDefault: true,
      });

      expect(address).toBeDefined();
      expect(address.id).toBeDefined();
      expect(address.recipientName).toBe('Meera Nair');
      expect(address.postalCode).toBe('560038');
      expect(address.isDefault).toBe(true);
      createdAddressId = address.id;
    });

    it('lists customer saved addresses ordered by default flag', async () => {
      const addresses = await addressService.listAddresses(customerUser.id);
      expect(addresses.length).toBeGreaterThanOrEqual(1);
      expect(addresses[0]!.id).toBe(createdAddressId);
      expect(addresses[0]!.isDefault).toBe(true);
    });
  });

  describe('3. Server-Authoritative Pricing Engine', () => {
    it('computes exact integer pricing breakdown with platform coupon discount', async () => {
      const cart = await cartService.getCart({ customerId: customerUser.id });

      // Calculate pricing with coupon
      const pricing = await pricingService.calculateCartPricing(cart, couponCode);

      expect(pricing.currency).toBe('INR');
      expect(pricing.couponCode).toBe(couponCode);
      expect(pricing.sellers).toHaveLength(2);

      // Total subtotal: 2 * 85000 + 2 * 140000 = 170000 + 280000 = 450000 paise (₹4,500.00)
      expect(pricing.subtotalMinor).toBe(450000);

      // 10% coupon discount on 450000 = 45000 paise (clamped to max 30000 paise = ₹300)
      expect(pricing.discountTotalMinor).toBe(30000);

      // Total grand total = subtotal (450000) + shipping (0) - discount (30000) = 420000 paise
      expect(pricing.grandTotalMinor).toBe(420000);

      // Ensure no floating point amounts
      expect(Number.isInteger(pricing.grandTotalMinor)).toBe(true);
      expect(Number.isInteger(pricing.discountTotalMinor)).toBe(true);
    });

    it('rejects coupon if order subtotal is below minimum order threshold', async () => {
      // Clear cart and add only 1 item of ₹850.00 (below ₹1,000 threshold)
      await cartService.clearCart({ customerId: customerUser.id });
      await cartService.addItem(
        { customerId: customerUser.id },
        { variantId: variantAId, quantity: 1 },
      );

      const cart = await cartService.getCart({ customerId: customerUser.id });

      await expect(pricingService.calculateCartPricing(cart, couponCode)).rejects.toThrow(
        /requires a minimum order of/,
      );
    });
  });

  describe('4. Atomic Inventory Reservation & Concurrency Safety', () => {
    it('creates a 15-minute stock reservation hold and decrements available inventory', async () => {
      const stockBefore = await inventoryService.getVariantStock(variantAId);
      const initialAvailable = stockBefore.availableQuantity;

      // Reserve 2 units
      const checkoutId = `chk_test_${Date.now()}`;
      const reservationIds = await inventoryService.createReservations(
        [{ variantId: variantAId, quantity: 2 }],
        checkoutId,
        undefined,
        15,
      );

      expect(reservationIds).toHaveLength(1);

      // Check available stock
      const stockAfter = await inventoryService.getVariantStock(variantAId);
      expect(stockAfter.quantityReserved).toBe(stockBefore.quantityReserved + 2);
      expect(stockAfter.availableQuantity).toBe(initialAvailable - 2);

      // Release reservation
      await inventoryService.releaseReservations(checkoutId);

      const stockRestored = await inventoryService.getVariantStock(variantAId);
      expect(stockRestored.availableQuantity).toBe(initialAvailable);
    });

    it('strictly prevents overselling when requested stock exceeds on-hand availability', async () => {
      const checkoutId = `chk_oversell_${Date.now()}`;
      // Request 999 units when only 10 on hand
      await expect(
        inventoryService.createReservations(
          [{ variantId: variantAId, quantity: 999 }],
          checkoutId,
          undefined,
          15,
        ),
      ).rejects.toThrow(/Insufficient stock for variant/);
    });
  });

  describe('5. Checkout Flow & Multi-Artisan Order Creation', () => {
    let createdCheckoutSessionId: string;
    let confirmedOrderNumber: string;

    it('creates checkout session and locks inventory', async () => {
      // Add items to customer cart: 1 vase from seller A, 1 bowl from seller B
      await cartService.clearCart({ customerId: customerUser.id });
      await cartService.addItem(
        { customerId: customerUser.id },
        { variantId: variantAId, quantity: 1 },
      );
      await cartService.addItem(
        { customerId: customerUser.id },
        { variantId: variantBId, quantity: 1 },
      );

      const session = await checkoutService.createCheckoutSession(
        { customerId: customerUser.id },
        {},
      );

      expect(session).toBeDefined();
      expect(session.checkoutId).toBeDefined();
      expect(session.reservationIds.length).toBeGreaterThan(0);
      expect(session.pricing.sellers).toHaveLength(2);
      createdCheckoutSessionId = session.checkoutId;
    });

    it('confirms checkout, creating parent customer order and artisan sub-orders in PENDING payment status', async () => {
      const confirmation = await checkoutService.confirmCheckout(
        customerUser.id,
        {
          checkoutSessionId: createdCheckoutSessionId,
          customerNote: 'Please pack carefully, porcelain gift',
        },
        `idem_key_${Date.now()}`,
      );

      expect(confirmation).toBeDefined();
      expect(confirmation.orderId).toBeDefined();
      expect(confirmation.orderNumber).toMatch(/^ORD-/);
      expect(confirmation.customerId).toBe(customerUser.id);

      // Strict Gate G08 Invariants:
      expect(confirmation.paymentStatus).toBe('PENDING');
      expect(confirmation.orderStatus).toBe('PLACED');

      // Verify partitioned artisan sub-orders:
      expect(confirmation.subOrders).toHaveLength(2);

      const subOrderA = confirmation.subOrders.find((s) => s.sellerId === sellerAProfileId);
      expect(subOrderA).toBeDefined();
      expect(subOrderA!.subOrderNumber).toMatch(/-S[12]$/);
      expect(subOrderA!.status).toBe('CONFIRMED');
      expect(subOrderA!.itemSubtotalMinor).toBe(85000);

      const subOrderB = confirmation.subOrders.find((s) => s.sellerId === sellerBProfileId);
      expect(subOrderB).toBeDefined();
      expect(subOrderB!.itemSubtotalMinor).toBe(140000);

      confirmedOrderNumber = confirmation.orderNumber;

      // Verify customer shopping cart was automatically cleared
      const cartAfterConfirm = await cartService.getCart({ customerId: customerUser.id });
      expect(cartAfterConfirm.itemsCount).toBe(0);
    });

    it('enforces idempotency preventing duplicate order submission for same checkout session', async () => {
      await expect(
        checkoutService.confirmCheckout(
          customerUser.id,
          {
            checkoutSessionId: createdCheckoutSessionId,
          },
          'duplicate_call',
        ),
      ).rejects.toThrow();
    });

    it('retrieves order details by order number for the authorized customer', async () => {
      const order = await checkoutService.getOrderByNumber(customerUser.id, confirmedOrderNumber);

      expect(order).toBeDefined();
      expect(order.orderNumber).toBe(confirmedOrderNumber);
      expect(order.paymentStatus).toBe('PENDING');
      expect(order.orderStatus).toBe('PLACED');
      expect(order.subOrders).toHaveLength(2);
      expect(order.shippingAddress.recipientName).toBe('Meera Nair');
    });
  });
});

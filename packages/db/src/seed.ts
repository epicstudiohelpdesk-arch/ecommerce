import { createDbClient } from './client.js';
import * as s from './schema/index.js';
import { fileURLToPath } from 'node:url';

export async function seedDatabase(connectionString?: string) {
  const targetUrl =
    connectionString || process.env.DATABASE_URL || 'postgresql://localhost:5432/marketplace_dev';

  // Safety check: Never seed production!
  if (
    process.env.NODE_ENV === 'production' ||
    targetUrl.includes('prod') ||
    targetUrl.includes('neon.tech') ||
    targetUrl.includes('aws')
  ) {
    throw new Error('FATAL: Database seeding is forbidden in production environments!');
  }

  const { db, close } = createDbClient({ connectionString: targetUrl, maxConnections: 1 });

  console.log(
    `[SEED] Seeding deterministic fixtures to: ${targetUrl.replace(/\/\/[^@]+@/, '//***@')}`,
  );

  try {
    // 1. Roles
    await db
      .insert(s.roles)
      .values([
        { name: 'SUPER_ADMIN', description: 'Platform super administrator' },
        { name: 'SELLER_OWNER', description: 'Artisan shop primary owner' },
        { name: 'APPROVED_SELLER', description: 'Approved artisan storefront operator' },
        { name: 'SELLER_APPLICANT', description: 'Artisan applicant under compliance review' },
        {
          name: 'RESTRICTED_SELLER',
          description: 'Artisan seller under sanction or policy restriction',
        },
        { name: 'CUSTOMER', description: 'Registered marketplace customer' },
        { name: 'CUSTOMER_SUPPORT', description: 'Customer support staff' },
        { name: 'MARKETPLACE_MANAGER', description: 'Marketplace operational catalog manager' },
        {
          name: 'FINANCE_CONTROLLER',
          description: 'Finance controller managing payouts and reconciliation',
        },
        { name: 'TRUST_SAFETY', description: 'Trust & safety compliance reviewer' },
        { name: 'READ_ONLY_ANALYST', description: 'Read-only business analytics staff' },
      ])
      .onConflictDoNothing()
      .returning();

    // 2. Chart of Accounts
    await db
      .insert(s.ledgerAccounts)
      .values([
        {
          code: '1010_PAYMENT_PROCESSOR',
          name: 'Payment Processor Clearing Account',
          type: 'ASSET',
          currency: 'INR',
          description: 'Clearing account for customer gateway collections',
        },
        {
          code: '2010_CUSTOMER_ESCROW',
          name: 'Customer Escrow Holding Liability',
          type: 'LIABILITY',
          currency: 'INR',
          description: 'Escrow held for customer orders pending fulfillment',
        },
        {
          code: '2020_SELLER_PAYABLE',
          name: 'Seller Payable Settlement Liability',
          type: 'LIABILITY',
          currency: 'INR',
          description: 'Funds cleared and payable to sellers for completed orders',
        },
        {
          code: '4010_MARKETPLACE_COMMISSION',
          name: 'Marketplace Commission Revenue',
          type: 'REVENUE',
          currency: 'INR',
          description: 'Platform commissions earned from completed orders',
        },
        {
          code: '5010_GATEWAY_FEES',
          name: 'Payment Gateway Processing Expense',
          type: 'EXPENSE',
          currency: 'INR',
          description: 'Third-party processor processing fees',
        },
      ])
      .onConflictDoNothing();

    // 3. Fictional Users
    const [artisanUser1] = await db
      .insert(s.users)
      .values({
        email: 'artisan.indira@example.test',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fictional_hash_artisan_1',
        firstName: 'Indira',
        lastName: 'Sharma',
        phone: '+919876543210',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .onConflictDoNothing()
      .returning();

    const [artisanUser2] = await db
      .insert(s.users)
      .values({
        email: 'artisan.ramesh@example.test',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fictional_hash_artisan_2',
        firstName: 'Ramesh',
        lastName: 'Chandra',
        phone: '+919876543211',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .onConflictDoNothing()
      .returning();

    const [customerUser] = await db
      .insert(s.users)
      .values({
        email: 'customer.ananya@example.test',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fictional_hash_customer',
        firstName: 'Ananya',
        lastName: 'Roy',
        phone: '+919876543212',
        status: 'ACTIVE',
        isEmailVerified: true,
      })
      .onConflictDoNothing()
      .returning();

    if (!artisanUser1 || !artisanUser2 || !customerUser) {
      console.log('[SEED] Fixtures already exist, skipping insert.');
      return;
    }

    // 4. Seller Profiles
    const [seller1] = await db
      .insert(s.sellerProfiles)
      .values({
        userId: artisanUser1.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Indira Sharma Pottery Crafts',
        taxId: '29ABCDE1234F1Z5',
        verificationStatus: 'VERIFIED',
        complianceTier: 2,
        isPayoutEnabled: true,
        commissionRateBps: 1000, // 10%
        verifiedAt: new Date(),
      })
      .returning();

    const [seller2] = await db
      .insert(s.sellerProfiles)
      .values({
        userId: artisanUser2.id,
        businessType: 'SOLE_PROPRIETORSHIP',
        legalName: 'Chandra Handcrafted Woods',
        taxId: '29FGHIJ5678K1Z2',
        verificationStatus: 'VERIFIED',
        complianceTier: 2,
        isPayoutEnabled: true,
        commissionRateBps: 1200, // 12%
        verifiedAt: new Date(),
      })
      .returning();

    if (!seller1 || !seller2) {
      throw new Error('[SEED] Failed to initialize sellers');
    }

    // 5. Shops
    const [shop1] = await db
      .insert(s.shops)
      .values({
        sellerId: seller1.id,
        name: 'Clay & Kiln Studio',
        slug: 'clay-and-kiln',
        description: 'Authentic hand-thrown terracotta and stoneware ceramics.',
        craftStory: 'Rooted in Bengal terracotta traditions, each piece is fired in wood kilns.',
        ratingAverage: '4.90',
        ratingCount: 14,
      })
      .returning();

    const [shop2] = await db
      .insert(s.shops)
      .values({
        sellerId: seller2.id,
        name: 'Sandalwood & Teak Artisan Crafts',
        slug: 'sandalwood-teak-crafts',
        description: 'Heirloom woodworking, hand-carved from reclaimed teak and rosewood.',
        craftStory: 'Four generations of master woodcarvers from Mysuru.',
        ratingAverage: '4.85',
        ratingCount: 22,
      })
      .returning();

    // 6. Categories
    const [potteryCat] = await db
      .insert(s.categories)
      .values({
        name: 'Pottery & Ceramics',
        slug: 'pottery-ceramics',
        description: 'Handmade vases, tableware, and sculptural pottery.',
      })
      .returning();

    const [woodCat] = await db
      .insert(s.categories)
      .values({
        name: 'Woodcrafts & Carvings',
        slug: 'woodcrafts-carvings',
        description: 'Hand-carved wooden tableware, boxes, and decor.',
      })
      .returning();

    if (!shop1 || !shop2 || !potteryCat || !woodCat) {
      throw new Error('[SEED] Failed to initialize shops or categories');
    }

    // 7. Products and Variants
    // Artisan 1 - Ready to Ship Chai Cups
    const [chaiCups] = await db
      .insert(s.products)
      .values({
        sellerId: seller1.id,
        categoryId: potteryCat.id,
        productType: 'READY_TO_SHIP',
        title: 'Handcrafted Terracotta Chai Cups (Set of 4)',
        slug: 'handcrafted-terracotta-chai-cups-set-of-4',
        description:
          'Traditional unglazed earthen kulhad cups, naturally cooling and biodegradable.',
        basePriceMinor: 85000, // ₹850.00
        currency: 'INR',
        moderationStatus: 'APPROVED',
        isActive: true,
        isFragile: true,
        materials: ['Clay', 'Terracotta'],
        techniques: ['Wheel-thrown', 'Wood-fired'],
      })
      .returning();

    if (!chaiCups) {
      throw new Error('[SEED] Failed to initialize chaiCups');
    }

    const [chaiCupsVariant] = await db
      .insert(s.productVariants)
      .values({
        productId: chaiCups.id,
        sku: 'CK-CUP-TER-04',
        title: 'Set of 4 (150ml each)',
        priceMinor: 85000,
        currency: 'INR',
        weightGrams: 600,
        dimensionLengthMm: 160,
        dimensionWidthMm: 160,
        dimensionHeightMm: 90,
      })
      .returning();

    if (!chaiCupsVariant) {
      throw new Error('[SEED] Failed to initialize chaiCupsVariant');
    }

    // Stock for Chai Cups
    await db.insert(s.inventoryItems).values({
      variantId: chaiCupsVariant.id,
      quantityOnHand: 20,
      quantityReserved: 0,
      lowStockThreshold: 3,
    });

    // Artisan 2 - Ready to Ship Coasters
    const [coasters] = await db
      .insert(s.products)
      .values({
        sellerId: seller2.id,
        categoryId: woodCat.id,
        productType: 'READY_TO_SHIP',
        title: 'Hand-carved Teakwood Coasters with Brass Inlay (Set of 6)',
        slug: 'hand-carved-teakwood-coasters-set-of-6',
        description: 'Reclaimed teakwood coasters with hand-beaten geometric brass inlay.',
        basePriceMinor: 120000, // ₹1,200.00
        currency: 'INR',
        moderationStatus: 'APPROVED',
        isActive: true,
        materials: ['Reclaimed Teakwood', 'Brass'],
        techniques: ['Hand-chiseled', 'Wax-buffed'],
      })
      .returning();

    if (!coasters) {
      throw new Error('[SEED] Failed to initialize coasters');
    }

    const [coastersVariant] = await db
      .insert(s.productVariants)
      .values({
        productId: coasters.id,
        sku: 'ST-CST-TEAK-06',
        title: 'Set of 6 with Holder',
        priceMinor: 120000,
        currency: 'INR',
        weightGrams: 450,
        dimensionLengthMm: 110,
        dimensionWidthMm: 110,
        dimensionHeightMm: 80,
      })
      .returning();

    if (!coastersVariant) {
      throw new Error('[SEED] Failed to initialize coastersVariant');
    }

    if (!chaiCups || !chaiCupsVariant || !coasters || !coastersVariant) {
      throw new Error('[SEED] Failed to initialize products or variants');
    }

    // Stock for Chai Cups
    await db.insert(s.inventoryItems).values({
      variantId: chaiCupsVariant.id,
      quantityOnHand: 20,
      quantityReserved: 0,
      lowStockThreshold: 3,
    });

    // Stock for Coasters
    await db.insert(s.inventoryItems).values({
      variantId: coastersVariant.id,
      quantityOnHand: 15,
      quantityReserved: 0,
      lowStockThreshold: 2,
    });

    // 8. Multi-Seller Customer Order Example
    const totalOrderAmount = 85000 + 120000 + 15000; // items + ₹150 shipping = ₹2,200.00
    const [order] = await db
      .insert(s.customerOrders)
      .values({
        orderNumber: 'ORD-20261012-0001',
        customerId: customerUser.id,
        totalAmountMinor: totalOrderAmount,
        currency: 'INR',
        paymentStatus: 'PAID',
        orderStatus: 'PROCESSING',
        shippingAddress: {
          recipient: 'Ananya Roy',
          addressLine1: 'Flat 402, Lotus Greens',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560034',
          country: 'IN',
        },
        billingAddress: {
          recipient: 'Ananya Roy',
          addressLine1: 'Flat 402, Lotus Greens',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560034',
          country: 'IN',
        },
      })
      .returning();

    if (!order) {
      throw new Error('[SEED] Failed to initialize customer order');
    }

    // Sub-Order 1 (Clay & Kiln Studio)
    const [subOrder1] = await db
      .insert(s.subOrders)
      .values({
        subOrderNumber: 'ORD-20261012-0001-S1',
        parentOrderId: order.id,
        sellerId: seller1.id,
        shopId: shop1.id,
        status: 'CONFIRMED',
        itemSubtotalMinor: 85000,
        shippingFeeMinor: 7500,
        commissionRateBps: 1000, // 10% on 85000 = 8500
        commissionFeeMinor: 8500,
        taxMinor: 0,
        netSellerPayableMinor: 85000 + 7500 - 8500, // 84000
        currency: 'INR',
      })
      .returning();

    if (!subOrder1) {
      throw new Error('[SEED] Failed to initialize sub-order 1');
    }

    // Order Item 1 (Chai Cups linked strictly to subOrder1 & seller1)
    await db.insert(s.orderItems).values({
      subOrderId: subOrder1.id,
      sellerId: seller1.id,
      variantId: chaiCupsVariant.id,
      titleSnapshot: 'Handcrafted Terracotta Chai Cups (Set of 4)',
      skuSnapshot: 'CK-CUP-TER-04',
      unitPriceMinor: 85000,
      quantity: 1,
      totalPriceMinor: 85000,
    });

    // Sub-Order 2 (Sandalwood & Teak)
    const [subOrder2] = await db
      .insert(s.subOrders)
      .values({
        subOrderNumber: 'ORD-20261012-0001-S2',
        parentOrderId: order.id,
        sellerId: seller2.id,
        shopId: shop2.id,
        status: 'CONFIRMED',
        itemSubtotalMinor: 120000,
        shippingFeeMinor: 7500,
        commissionRateBps: 1200, // 12% on 120000 = 14400
        commissionFeeMinor: 14400,
        taxMinor: 0,
        netSellerPayableMinor: 120000 + 7500 - 14400, // 113100
        currency: 'INR',
      })
      .returning();

    if (!subOrder2) {
      throw new Error('[SEED] Failed to initialize sub-order 2');
    }

    // Order Item 2 (Coasters linked strictly to subOrder2 & seller2)
    await db.insert(s.orderItems).values({
      subOrderId: subOrder2.id,
      sellerId: seller2.id,
      variantId: coastersVariant.id,
      titleSnapshot: 'Hand-carved Teakwood Coasters with Brass Inlay (Set of 6)',
      skuSnapshot: 'ST-CST-TEAK-06',
      unitPriceMinor: 120000,
      quantity: 1,
      totalPriceMinor: 120000,
    });

    console.log('[SEED] Deterministic fixtures successfully created!');
  } finally {
    await close();
  }
}

// Allow direct CLI execution via tsx/node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SEED] Seeding failed:', err);
      process.exit(1);
    });
}

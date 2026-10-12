import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestClient } from './test-db.js';
import * as s from '../src/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Seller Multi-Tenant Isolation & Relational Safeguards', () => {
  let testClient: ReturnType<typeof createIsolatedTestClient>;

  beforeAll(async () => {
    testClient = createIsolatedTestClient();
  });

  afterAll(async () => {
    await testClient.close();
  });

  it('strictly rejects attaching an order item to a sub-order belonging to a different seller', async () => {
    // 1. Create 2 independent sellers
    const [userA] = await testClient.db
      .insert(s.users)
      .values({
        email: 'artisan.a@isolation.test',
        passwordHash: 'hash',
        firstName: 'Artisan',
        lastName: 'A',
      })
      .returning();

    const [userB] = await testClient.db
      .insert(s.users)
      .values({
        email: 'artisan.b@isolation.test',
        passwordHash: 'hash',
        firstName: 'Artisan',
        lastName: 'B',
      })
      .returning();

    const [sellerA] = await testClient.db
      .insert(s.sellerProfiles)
      .values({
        userId: userA.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Studio A',
      })
      .returning();

    const [sellerB] = await testClient.db
      .insert(s.sellerProfiles)
      .values({
        userId: userB.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Studio B',
      })
      .returning();

    const [shopA] = await testClient.db
      .insert(s.shops)
      .values({
        sellerId: sellerA.id,
        name: 'Shop A',
        slug: 'shop-a-isolation',
      })
      .returning();

    const [category] = await testClient.db
      .insert(s.categories)
      .values({
        name: 'Isolation Category',
        slug: 'isolation-cat',
      })
      .returning();

    // 2. Create products for each seller
    const [productA] = await testClient.db
      .insert(s.products)
      .values({
        sellerId: sellerA.id,
        categoryId: category.id,
        productType: 'READY_TO_SHIP',
        title: 'Product A',
        slug: 'product-a-isolation',
        description: 'Artisan A Item',
        basePriceMinor: 50000,
      })
      .returning();

    const [variantA] = await testClient.db
      .insert(s.productVariants)
      .values({
        productId: productA.id,
        sku: 'SKU-A-01',
        title: 'Variant A',
        priceMinor: 50000,
        weightGrams: 200,
        dimensionLengthMm: 100,
        dimensionWidthMm: 100,
        dimensionHeightMm: 100,
      })
      .returning();

    // 3. Create customer and parent order
    const [customer] = await testClient.db
      .insert(s.users)
      .values({
        email: 'customer.iso@test.com',
        passwordHash: 'hash',
        firstName: 'Customer',
        lastName: 'Iso',
      })
      .returning();

    const [parentOrder] = await testClient.db
      .insert(s.customerOrders)
      .values({
        orderNumber: 'ORD-ISO-001',
        customerId: customer.id,
        totalAmountMinor: 50000,
        shippingAddress: { city: 'Delhi' },
        billingAddress: { city: 'Delhi' },
      })
      .returning();

    // 4. Create sub-order strictly assigned to Seller A
    const [subOrderA] = await testClient.db
      .insert(s.subOrders)
      .values({
        subOrderNumber: 'ORD-ISO-001-SA',
        parentOrderId: parentOrder.id,
        sellerId: sellerA.id,
        shopId: shopA.id,
        itemSubtotalMinor: 50000,
        shippingFeeMinor: 0,
        commissionRateBps: 1000,
        commissionFeeMinor: 5000,
        netSellerPayableMinor: 45000,
      })
      .returning();

    // 5. ATTEMPT VIOLATION: Insert order item pointing to subOrderA.id, but with sellerB.id!
    // The composite foreign key fk_order_items_sub_order_seller (sub_order_id, seller_id) -> sub_orders(id, seller_id)
    // MUST reject this mismatch at the database level!
    await expect(
      testClient.db.insert(s.orderItems).values({
        subOrderId: subOrderA.id,
        sellerId: sellerB.id, // TAMPERED SELLER ID!
        variantId: variantA.id,
        titleSnapshot: 'Tampered Item',
        skuSnapshot: 'SKU-A-01',
        unitPriceMinor: 50000,
        quantity: 1,
        totalPriceMinor: 50000,
      }),
    ).rejects.toThrow();

    // 6. Legitimate insertion with matching sellerA.id succeeds
    const [validItem] = await testClient.db
      .insert(s.orderItems)
      .values({
        subOrderId: subOrderA.id,
        sellerId: sellerA.id, // Legitimate owner
        variantId: variantA.id,
        titleSnapshot: 'Valid Item',
        skuSnapshot: 'SKU-A-01',
        unitPriceMinor: 50000,
        quantity: 1,
        totalPriceMinor: 50000,
      })
      .returning();

    expect(validItem.id).toBeDefined();
    expect(validItem.sellerId).toBe(sellerA.id);
  });

  it('enforces verified purchase on customer reviews and rejects duplicates', async () => {
    // Attempting duplicate review for the same order item
    const [item] = await testClient.db.select().from(s.orderItems).limit(1);
    const [customer] = await testClient.db
      .select()
      .from(s.users)
      .where(eq(s.users.email, 'customer.iso@test.com'));

    const [variant] = await testClient.db
      .select()
      .from(s.productVariants)
      .where(eq(s.productVariants.id, item.variantId));

    const [product] = await testClient.db
      .select()
      .from(s.products)
      .where(eq(s.products.id, variant.productId));

    // Post review 1
    await testClient.db.insert(s.reviews).values({
      customerId: customer.id,
      productId: product.id,
      orderItemId: item.id,
      rating: 5,
      title: 'Amazing craft',
      comment: 'Loved the handmade quality!',
    });

    // Post duplicate review for same order item must fail
    await expect(
      testClient.db.insert(s.reviews).values({
        customerId: customer.id,
        productId: product.id,
        orderItemId: item.id,
        rating: 4,
        title: 'Duplicate review attempt',
      }),
    ).rejects.toThrow();
  });
});

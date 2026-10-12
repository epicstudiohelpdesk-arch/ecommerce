import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestClient } from './test-db.js';
import * as s from '../src/schema/index.js';
import { eq } from 'drizzle-orm';

describe('Inventory Concurrency & Atomic Reservation Safeguards', () => {
  let testClient: ReturnType<typeof createIsolatedTestClient>;

  beforeAll(async () => {
    testClient = createIsolatedTestClient();
  });

  afterAll(async () => {
    await testClient.close();
  });

  /**
   * Helper implementing the production atomic reservation protocol with 15-minute TTL
   */
  async function atomicReserveStock(
    variantId: string,
    checkoutId: string,
    quantity: number,
  ): Promise<{ success: boolean; reservationId?: string; error?: string }> {
    return await testClient.client.begin(async (sqlTx) => {
      // 1. Atomic conditional update on inventory_items
      const updated = await sqlTx`
        UPDATE inventory_items
        SET quantity_reserved = quantity_reserved + ${quantity},
            updated_at = NOW()
        WHERE variant_id = ${variantId}::uuid
          AND (quantity_on_hand - quantity_reserved) >= ${quantity}
        RETURNING id, quantity_on_hand, quantity_reserved;
      `;

      if (updated.length === 0) {
        return { success: false, error: 'INSUFFICIENT_STOCK' };
      }

      // 2. Insert active reservation record with 15-minute TTL
      const [res] = await sqlTx`
        INSERT INTO inventory_reservations (
          variant_id, checkout_id, quantity, status, expires_at
        ) VALUES (
          ${variantId}::uuid, ${checkoutId}, ${quantity}, 'ACTIVE', NOW() + INTERVAL '15 minutes'
        ) RETURNING id;
      `;

      return { success: true, reservationId: res.id };
    });
  }

  it('prevents overselling of One-of-a-Kind (N=1) item during concurrent checkout attempts', async () => {
    // 1. Setup artisan and OOAK product
    const [user] = await testClient.db
      .insert(s.users)
      .values({
        email: 'artisan.ooak@test.com',
        passwordHash: 'hash',
        firstName: 'Artisan',
        lastName: 'OOAK',
      })
      .returning();

    const [seller] = await testClient.db
      .insert(s.sellerProfiles)
      .values({
        userId: user.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Studio OOAK',
      })
      .returning();

    const [category] = await testClient.db
      .insert(s.categories)
      .values({
        name: 'Sculptures',
        slug: 'sculptures-unique',
      })
      .returning();

    const [product] = await testClient.db
      .insert(s.products)
      .values({
        sellerId: seller.id,
        categoryId: category.id,
        productType: 'ONE_OF_A_KIND', // Strictly unique single item
        title: 'Original Wood Carved Deity',
        slug: 'original-wood-carved-deity',
        description: 'Single OOAK item',
        basePriceMinor: 250000,
      })
      .returning();

    const [variant] = await testClient.db
      .insert(s.productVariants)
      .values({
        productId: product.id,
        sku: 'OOAK-DEITY-01',
        title: 'Unique Piece (1 of 1)',
        priceMinor: 250000,
        weightGrams: 1500,
        dimensionLengthMm: 300,
        dimensionWidthMm: 150,
        dimensionHeightMm: 150,
      })
      .returning();

    // Exactly 1 unit on hand!
    await testClient.db.insert(s.inventoryItems).values({
      variantId: variant.id,
      quantityOnHand: 1,
      quantityReserved: 0,
    });

    // 2. Fire 2 simultaneous reservation attempts for the same single unit
    const [result1, result2] = await Promise.all([
      atomicReserveStock(variant.id, 'chk_session_cust_1', 1),
      atomicReserveStock(variant.id, 'chk_session_cust_2', 1),
    ]);

    // 3. Exactly ONE attempt MUST succeed, and the other MUST fail!
    const successCount = [result1, result2].filter((r) => r.success).length;
    const failureCount = [result1, result2].filter((r) => !r.success).length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // 4. Verify inventory state in database
    const [inv] = await testClient.db
      .select()
      .from(s.inventoryItems)
      .where(eq(s.inventoryItems.variantId, variant.id));

    expect(inv.quantityOnHand).toBe(1);
    expect(inv.quantityReserved).toBe(1); // Exactly 1 reserved
  });

  it('rejects illegal stock updates violating check constraint chk_inventory_reserved_le_on_hand', async () => {
    // Attempting direct raw update setting reserved > on_hand must be blocked by PostgreSQL CHECK constraint
    await expect(
      testClient.client`
        UPDATE inventory_items
        SET quantity_reserved = 10, quantity_on_hand = 5;
      `,
    ).rejects.toThrow();
  });

  it('safely expires reservations and releases held inventory back to available pool', async () => {
    // 1. Create variant with 5 units on hand
    const [user] = await testClient.db
      .select()
      .from(s.users)
      .where(eq(s.users.email, 'artisan.ooak@test.com'));
    const [seller] = await testClient.db
      .select()
      .from(s.sellerProfiles)
      .where(eq(s.sellerProfiles.userId, user.id));
    const [category] = await testClient.db
      .select()
      .from(s.categories)
      .where(eq(s.categories.slug, 'sculptures-unique'));

    const [product] = await testClient.db
      .insert(s.products)
      .values({
        sellerId: seller.id,
        categoryId: category.id,
        productType: 'READY_TO_SHIP',
        title: 'Ceramic Bowls',
        slug: 'ceramic-bowls-ttl',
        description: 'Bowls for TTL test',
        basePriceMinor: 40000,
      })
      .returning();

    const [variant] = await testClient.db
      .insert(s.productVariants)
      .values({
        productId: product.id,
        sku: 'CER-BOWL-TTL',
        title: 'Bowl',
        priceMinor: 40000,
        weightGrams: 300,
        dimensionLengthMm: 120,
        dimensionWidthMm: 120,
        dimensionHeightMm: 60,
      })
      .returning();

    await testClient.db.insert(s.inventoryItems).values({
      variantId: variant.id,
      quantityOnHand: 5,
      quantityReserved: 2, // 2 units currently reserved
    });

    // Create an EXPIRED reservation in the past (16 minutes ago)
    const expiredTimestamp = new Date(Date.now() - 16 * 60 * 1000);
    const [reservation] = await testClient.db
      .insert(s.inventoryReservations)
      .values({
        variantId: variant.id,
        checkoutId: 'chk_expired_session',
        quantity: 2,
        status: 'ACTIVE',
        expiresAt: expiredTimestamp,
      })
      .returning();

    // 2. Execute reservation expiry sweeper query
    await testClient.client.begin(async (sqlTx) => {
      // Find expired active reservations
      const expiredList = await sqlTx`
        UPDATE inventory_reservations
        SET status = 'EXPIRED', updated_at = NOW()
        WHERE id = ${reservation.id}::uuid
          AND status = 'ACTIVE'
          AND expires_at < NOW()
        RETURNING id, variant_id, quantity;
      `;

      for (const exp of expiredList) {
        await sqlTx`
          UPDATE inventory_items
          SET quantity_reserved = quantity_reserved - ${exp.quantity},
              updated_at = NOW()
          WHERE variant_id = ${exp.variant_id}::uuid;
        `;
      }
    });

    // 3. Verify stock has returned to available pool
    const [invAfter] = await testClient.db
      .select()
      .from(s.inventoryItems)
      .where(eq(s.inventoryItems.variantId, variant.id));

    expect(invAfter.quantityReserved).toBe(0);
    expect(invAfter.quantityOnHand).toBe(5);
  });
});

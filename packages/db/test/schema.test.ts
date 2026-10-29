import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestClient } from './test-db.js';
import * as s from '../src/schema/index.js';

describe('Schema & Referential Integrity Tests', () => {
  let testClient: ReturnType<typeof createIsolatedTestClient>;

  beforeAll(async () => {
    testClient = createIsolatedTestClient();
  });

  afterAll(async () => {
    await testClient.close();
  });

  it('verifies that all expected tables exist in the migrated database', async () => {
    const result = await testClient.client`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `;
    const tableNames = result.map((r: { tablename: string }) => r.tablename);

    const expectedTables = [
      'users',
      'user_sessions',
      'roles',
      'permissions',
      'role_permissions',
      'user_roles',
      'audit_logs',
      'seller_profiles',
      'shops',
      'seller_documents',
      'pickup_addresses',
      'payout_accounts',
      'categories',
      'products',
      'product_variants',
      'product_media',
      'moderation_records',
      'inventory_items',
      'inventory_reservations',
      'stock_adjustments',
      'carts',
      'cart_items',
      'coupons',
      'pricing_snapshots',
      'customer_orders',
      'sub_orders',
      'order_items',
      'order_timeline_events',
      'payment_attempts',
      'payment_allocations',
      'payment_webhook_events',
      'refund_requests',
      'ledger_accounts',
      'ledger_entries',
      'seller_balances',
      'payout_batches',
      'payout_transactions',
      'shipments',
      'shipment_milestones',
      'return_requests',
      'reviews',
      'support_tickets',
      'support_ticket_messages',
      'disputes',
      'policy_reports',
      'risk_cases',
      'privacy_requests',
      'outbox_events',
    ];

    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });

  it('rejects invalid email formats via check constraint', async () => {
    await expect(
      testClient.db.insert(s.users).values({
        email: 'invalid-email-not-valid',
        passwordHash: 'argon2id_dummy_hash',
        firstName: 'Test',
        lastName: 'User',
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate user emails via unique constraint', async () => {
    const validEmail = 'unique.artisan@example.test';
    await testClient.db.insert(s.users).values({
      email: validEmail,
      passwordHash: 'hash1',
      firstName: 'First',
      lastName: 'User',
    });

    await expect(
      testClient.db.insert(s.users).values({
        email: validEmail,
        passwordHash: 'hash2',
        firstName: 'Second',
        lastName: 'User',
      }),
    ).rejects.toThrow(/unique/i);
  });

  it('rejects negative product base price via check constraint', async () => {
    // Create valid user and seller first
    const [user] = await testClient.db
      .insert(s.users)
      .values({
        email: 'seller.check@example.test',
        passwordHash: 'hash',
        firstName: 'Check',
        lastName: 'Seller',
      })
      .returning();

    const [seller] = await testClient.db
      .insert(s.sellerProfiles)
      .values({
        userId: user.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Check Crafts',
      })
      .returning();

    const [category] = await testClient.db
      .insert(s.categories)
      .values({
        name: 'Test Cat',
        slug: 'test-cat',
      })
      .returning();

    await expect(
      testClient.db.insert(s.products).values({
        sellerId: seller.id,
        categoryId: category.id,
        productType: 'READY_TO_SHIP',
        title: 'Negative Price Item',
        slug: 'negative-price-item',
        description: 'Should fail',
        basePriceMinor: -500, // Invalid negative price
      }),
    ).rejects.toThrow();
  });

  it('rejects duplicate payment webhook events via composite unique constraint', async () => {
    const eventId = 'evt_test_webhook_123';
    await testClient.db.insert(s.paymentWebhookEvents).values({
      provider: 'STRIPE',
      eventId: eventId,
      eventType: 'payment_intent.succeeded',
      payload: { id: eventId },
      payloadHash: 'hash_123',
    });

    // Inserting identical provider and eventId must fail
    await expect(
      testClient.db.insert(s.paymentWebhookEvents).values({
        provider: 'STRIPE',
        eventId: eventId,
        eventType: 'payment_intent.succeeded',
        payload: { id: eventId },
        payloadHash: 'hash_123',
      }),
    ).rejects.toThrow();
  });

  it('rejects foreign key violation when referencing a nonexistent category', async () => {
    const fakeCategoryId = '00000000-0000-0000-0000-000000009999';
    const [user] = await testClient.db
      .insert(s.users)
      .values({
        email: 'fk.test@example.test',
        passwordHash: 'hash',
        firstName: 'FK',
        lastName: 'Tester',
      })
      .returning();

    const [seller] = await testClient.db
      .insert(s.sellerProfiles)
      .values({
        userId: user.id,
        businessType: 'INDIVIDUAL',
        legalName: 'FK Crafts',
      })
      .returning();

    await expect(
      testClient.db.insert(s.products).values({
        sellerId: seller.id,
        categoryId: fakeCategoryId,
        productType: 'READY_TO_SHIP',
        title: 'Invalid FK Product',
        slug: 'invalid-fk-product',
        description: 'Should fail',
        basePriceMinor: 1000,
      }),
    ).rejects.toThrow();
  });
});

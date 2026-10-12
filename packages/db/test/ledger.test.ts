import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestClient } from './test-db.js';
import * as s from '../src/schema/index.js';

describe('Financial Integrity & Double-Entry Ledger Invariants', () => {
  let testClient: ReturnType<typeof createIsolatedTestClient>;
  let processorAccount: typeof s.ledgerAccounts.$inferSelect | undefined;
  let escrowAccount: typeof s.ledgerAccounts.$inferSelect | undefined;

  beforeAll(async () => {
    testClient = createIsolatedTestClient();

    // Setup standard Chart of Accounts if not existing
    const existingAccounts = await testClient.db.select().from(s.ledgerAccounts);
    let accounts = existingAccounts;
    if (accounts.length === 0) {
      accounts = await testClient.db
        .insert(s.ledgerAccounts)
        .values([
          {
            code: '1010_PROCESSOR',
            name: 'Payment Processor Clearing',
            type: 'ASSET',
            currency: 'INR',
          },
          {
            code: '2010_ESCROW',
            name: 'Customer Escrow Liability',
            type: 'LIABILITY',
            currency: 'INR',
          },
          {
            code: '2020_PAYABLE',
            name: 'Seller Settlement Payable',
            type: 'LIABILITY',
            currency: 'INR',
          },
          {
            code: '4010_COMMISSION',
            name: 'Marketplace Commission Revenue',
            type: 'REVENUE',
            currency: 'INR',
          },
        ])
        .returning();
    }

    processorAccount = accounts.find(
      (a) => a.code.includes('1010_PROCESSOR') || a.type === 'ASSET',
    );
    escrowAccount = accounts.find(
      (a) =>
        a.code.includes('2010_ESCROW') || (a.type === 'LIABILITY' && a.code.includes('ESCROW')),
    );
  });

  afterAll(async () => {
    await testClient.close();
  });

  /**
   * Safe transaction-level posting function enforcing the double-entry invariant:
   * sum(Debits) === sum(Credits)
   */
  async function postBalancedJournalBatch(
    entries: Array<{
      accountId: string;
      entryType: 'DEBIT' | 'CREDIT';
      amountMinor: number;
      description: string;
      sellerId?: string;
      subOrderId?: string;
    }>,
  ) {
    const totalDebits = entries
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + e.amountMinor, 0);

    const totalCredits = entries
      .filter((e) => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + e.amountMinor, 0);

    if (totalDebits !== totalCredits) {
      throw new Error(
        `UNBALANCED_JOURNAL_BATCH: Total Debits (${totalDebits}) does not equal Total Credits (${totalCredits})!`,
      );
    }

    const journalBatchId = crypto.randomUUID();

    return await testClient.client.begin(async (sqlTx) => {
      const inserted = [];
      for (const entry of entries) {
        const [row] = await sqlTx`
          INSERT INTO ledger_entries (
            journal_batch_id, account_id, seller_id, sub_order_id,
            entry_type, amount_minor, currency, description
          ) VALUES (
            ${journalBatchId}::uuid, ${entry.accountId}::uuid,
            ${entry.sellerId ? sqlTx`${entry.sellerId}::uuid` : null},
            ${entry.subOrderId ? sqlTx`${entry.subOrderId}::uuid` : null},
            ${entry.entryType}, ${entry.amountMinor}, 'INR', ${entry.description}
          ) RETURNING id;
        `;
        inserted.push(row);
      }
      return { journalBatchId, entriesCount: inserted.length };
    });
  }

  it('successfully posts a balanced double-entry customer order capture journal batch', async () => {
    // Payment capture:
    // DEBIT:  Asset (Payment Processor) ₹1,000.00 (100000 minor)
    // CREDIT: Liability (Customer Escrow) ₹1,000.00 (100000 minor)
    const result = await postBalancedJournalBatch([
      {
        accountId: processorAccount!.id,
        entryType: 'DEBIT',
        amountMinor: 100000,
        description: 'Captured customer payment for order ORD-100',
      },
      {
        accountId: escrowAccount!.id,
        entryType: 'CREDIT',
        amountMinor: 100000,
        description: 'Escrow hold for order ORD-100 pending fulfillment',
      },
    ]);

    expect(result.journalBatchId).toBeDefined();
    expect(result.entriesCount).toBe(2);

    // Verify both rows exist with identical journal_batch_id
    const rows = await testClient.client`
      SELECT * FROM ledger_entries WHERE journal_batch_id = ${result.journalBatchId}::uuid;
    `;
    expect(rows.length).toBe(2);
  });

  it('strictly rejects posting an unbalanced journal batch and rolls back', async () => {
    // Attempting to post an unbalanced entry:
    // DEBIT:  Asset ₹1,000.00
    // CREDIT: Liability ₹900.00 (Unbalanced by ₹100.00!)
    await expect(
      postBalancedJournalBatch([
        {
          accountId: processorAccount!.id,
          entryType: 'DEBIT',
          amountMinor: 100000,
          description: 'Payment collected',
        },
        {
          accountId: escrowAccount!.id,
          entryType: 'CREDIT',
          amountMinor: 90000, // Unequal!
          description: 'Defective credit',
        },
      ]),
    ).rejects.toThrow(/UNBALANCED_JOURNAL_BATCH/i);
  });

  it('rejects duplicate payment intents and duplicate idempotency keys', async () => {
    // Setup test order
    const [user] = await testClient.db
      .insert(s.users)
      .values({
        email: 'customer.payment@test.com',
        passwordHash: 'hash',
        firstName: 'Cust',
        lastName: 'Pay',
      })
      .returning();

    const [order] = await testClient.db
      .insert(s.customerOrders)
      .values({
        orderNumber: 'ORD-PAY-001',
        customerId: user.id,
        totalAmountMinor: 50000,
        shippingAddress: { city: 'Pune' },
        billingAddress: { city: 'Pune' },
      })
      .returning();

    const intentId = 'pi_test_stripe_unique_101';
    const idempotencyKey = 'idem_key_attempt_001';

    // Insert first payment attempt
    await testClient.db.insert(s.paymentAttempts).values({
      parentOrderId: order.id,
      provider: 'STRIPE',
      providerIntentId: intentId,
      idempotencyKey: idempotencyKey,
      amountMinor: 50000,
    });

    // Attempting duplicate provider_intent_id must fail
    await expect(
      testClient.db.insert(s.paymentAttempts).values({
        parentOrderId: order.id,
        provider: 'STRIPE',
        providerIntentId: intentId, // DUPLICATE!
        idempotencyKey: 'different_idem_key',
        amountMinor: 50000,
      }),
    ).rejects.toThrow();

    // Attempting duplicate idempotency_key must fail
    await expect(
      testClient.db.insert(s.paymentAttempts).values({
        parentOrderId: order.id,
        provider: 'STRIPE',
        providerIntentId: 'pi_different_intent',
        idempotencyKey: idempotencyKey, // DUPLICATE!
        amountMinor: 50000,
      }),
    ).rejects.toThrow();
  });

  it('enforces non-negative seller balance invariants', async () => {
    const [user] = await testClient.db
      .insert(s.users)
      .values({
        email: 'seller.balance@test.com',
        passwordHash: 'hash',
        firstName: 'Artisan',
        lastName: 'Bal',
      })
      .returning();

    const [seller] = await testClient.db
      .insert(s.sellerProfiles)
      .values({
        userId: user.id,
        businessType: 'INDIVIDUAL',
        legalName: 'Balance Studio',
      })
      .returning();

    // Valid balance initialization
    await testClient.db.insert(s.sellerBalances).values({
      sellerId: seller.id,
      pendingEscrowMinor: 100000,
      availablePayoutMinor: 50000,
      heldDisputeMinor: 0,
    });

    // Attempting negative balance via raw update must fail check constraint
    await expect(
      testClient.client`
        UPDATE seller_balances
        SET available_payout_minor = -500
        WHERE seller_id = ${seller.id}::uuid;
      `,
    ).rejects.toThrow();
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '../src/modules/database/database.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

describe('G09: Double-Entry Financial Ledger Service', () => {
  let dbService: DatabaseService;
  let ledgerService: LedgerService;

  let testSellerId: string;
  let testUserId: string;
  const testBatchIds: string[] = [];

  beforeAll(async () => {
    process.env['DATABASE_URL'] = 'postgresql://localhost:5432/marketplace_test';
    process.env['NODE_ENV'] = 'test';

    dbService = new DatabaseService();
    ledgerService = new LedgerService(dbService);

    // Ensure Chart of Accounts is initialized
    await ledgerService.ensureAccountsExist();

    // Create a test seller profile
    const email = `artisan.ledger.${Date.now()}@test.example`;
    const [user] = await dbService.db
      .insert(dbService.schema.users)
      .values({
        email,
        passwordHash: 'hash',
        firstName: 'Ledger',
        lastName: 'Artisan',
      })
      .returning();
    testUserId = user.id;

    const [seller] = await dbService.db
      .insert(dbService.schema.sellerProfiles)
      .values({
        userId: testUserId,
        businessType: 'INDIVIDUAL',
        legalName: 'Ledger Artisan Studio',
        commissionRateBps: 1000,
      })
      .returning();
    testSellerId = seller.id;
  });

  afterAll(async () => {
    // Clean up all journal batches created during tests
    for (const bId of testBatchIds) {
      await dbService.db
        .delete(dbService.schema.ledgerEntries)
        .where(eq(dbService.schema.ledgerEntries.journalBatchId, bId));
    }
    if (testSellerId) {
      await dbService.db
        .delete(dbService.schema.ledgerEntries)
        .where(eq(dbService.schema.ledgerEntries.sellerId, testSellerId));
      await dbService.db
        .delete(dbService.schema.sellerBalances)
        .where(eq(dbService.schema.sellerBalances.sellerId, testSellerId));
      await dbService.db
        .delete(dbService.schema.sellerProfiles)
        .where(eq(dbService.schema.sellerProfiles.id, testSellerId));
    }
    if (testUserId) {
      await dbService.db
        .delete(dbService.schema.users)
        .where(eq(dbService.schema.users.id, testUserId));
    }
  });

  it('initializes Chart of Accounts with standard asset, liability, and revenue codes', async () => {
    const assetId = await ledgerService.getAccountIdByCode('1010_PAYMENT_PROCESSOR');
    const escrowId = await ledgerService.getAccountIdByCode('2010_CUSTOMER_ESCROW');
    const commissionId = await ledgerService.getAccountIdByCode('4010_MARKETPLACE_COMMISSION');

    expect(assetId).toBeDefined();
    expect(escrowId).toBeDefined();
    expect(commissionId).toBeDefined();
  });

  it('posts a balanced journal batch successfully enforcing sum(Debits) === sum(Credits)', async () => {
    const batchId = randomUUID();
    testBatchIds.push(batchId);
    const result = await ledgerService.postBalancedJournalBatch({
      journalBatchId: batchId,
      entries: [
        {
          accountCode: '1010_PAYMENT_PROCESSOR',
          entryType: 'DEBIT',
          amountMinor: 100000, // ₹1,000.00
          description: 'Payment collected',
          currency: 'INR',
        },
        {
          accountCode: '2010_CUSTOMER_ESCROW',
          entryType: 'CREDIT',
          amountMinor: 90000, // ₹900.00 to seller
          description: 'Escrow hold for seller',
          sellerId: testSellerId,
          currency: 'INR',
        },
        {
          accountCode: '4010_MARKETPLACE_COMMISSION',
          entryType: 'CREDIT',
          amountMinor: 10000, // ₹100.00 platform take (10%)
          description: 'Marketplace commission fee',
          sellerId: testSellerId,
          currency: 'INR',
        },
      ],
    });

    expect(result.journalBatchId).toBe(batchId);
    expect(result.entriesCount).toBe(3);

    // Verify written rows in ledger_entries
    const rows = await dbService.db
      .select()
      .from(dbService.schema.ledgerEntries)
      .where(eq(dbService.schema.ledgerEntries.journalBatchId, batchId));

    expect(rows.length).toBe(3);
  });

  it('strictly rejects posting an unbalanced journal batch and throws an exception', async () => {
    await expect(
      ledgerService.postBalancedJournalBatch({
        entries: [
          {
            accountCode: '1010_PAYMENT_PROCESSOR',
            entryType: 'DEBIT',
            amountMinor: 100000, // ₹1,000
            description: 'Collected',
          },
          {
            accountCode: '2010_CUSTOMER_ESCROW',
            entryType: 'CREDIT',
            amountMinor: 85000, // ₹850 (Missing ₹150!)
            description: 'Escrow',
          },
        ],
      }),
    ).rejects.toThrow(/UNBALANCED_JOURNAL_BATCH/i);
  });

  it('credits artisan pending escrow balance upon payment capture', async () => {
    await ledgerService.creditSellerEscrow(testSellerId, 90000);

    const balance = await ledgerService.getSellerBalance(testSellerId);
    expect(balance.pendingEscrowMinor).toBe(90000);
    expect(balance.availablePayoutMinor).toBe(0);
  });

  it('debits artisan pending escrow balance upon refund, preventing overdrawing into negative balance', async () => {
    // Current pending escrow is 90000 paise.
    // Debit 40000 paise
    await ledgerService.debitSellerEscrow(testSellerId, 40000);

    const balance = await ledgerService.getSellerBalance(testSellerId);
    expect(balance.pendingEscrowMinor).toBe(50000);

    // Attempting to debit 60000 paise (more than 50000 available) must throw
    await expect(ledgerService.debitSellerEscrow(testSellerId, 60000)).rejects.toThrow(
      /Insufficient pending escrow balance/i,
    );
  });

  it('retrieves chronological ledger entries for an artisan seller', async () => {
    const entries = await ledgerService.getSellerLedgerEntries(testSellerId);
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0]?.sellerId).toBe(testSellerId);
    expect(entries[0]?.accountCode).toBeDefined();
  });
});

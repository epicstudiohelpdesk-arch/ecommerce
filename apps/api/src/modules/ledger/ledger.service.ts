import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { eq, sql, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import type { SellerBalanceStatementDto, LedgerEntryDto } from '@repo/api-contracts';

export interface JournalEntryInput {
  accountCode: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountMinor: number;
  description: string;
  sellerId?: string | null;
  subOrderId?: string | null;
  payoutBatchId?: string | null;
  currency?: string;
}

export interface PostJournalBatchParams {
  entries: JournalEntryInput[];
  journalBatchId?: string;
  memo?: string;
}

export const STANDARD_CHART_OF_ACCOUNTS = [
  {
    code: '1010_PAYMENT_PROCESSOR',
    name: 'Payment Processor Clearing Account',
    type: 'ASSET' as const,
    currency: 'INR',
    description: 'Clearing account for customer gateway collections',
  },
  {
    code: '2010_CUSTOMER_ESCROW',
    name: 'Customer Escrow Holding Liability',
    type: 'LIABILITY' as const,
    currency: 'INR',
    description: 'Escrow held for customer orders pending fulfillment',
  },
  {
    code: '2020_SELLER_PAYABLE',
    name: 'Seller Payable Settlement Liability',
    type: 'LIABILITY' as const,
    currency: 'INR',
    description: 'Funds cleared and payable to sellers for completed orders',
  },
  {
    code: '2030_CUSTOMER_REFUND',
    name: 'Customer Refund Clearing Liability',
    type: 'LIABILITY' as const,
    currency: 'INR',
    description: 'Liability held for customer return refunds',
  },
  {
    code: '2040_TAXES_PAYABLE',
    name: 'Taxes & Statutory Deductions Payable',
    type: 'LIABILITY' as const,
    currency: 'INR',
    description: 'Marketplace TCS/TDS and GST liabilities',
  },
  {
    code: '4010_MARKETPLACE_COMMISSION',
    name: 'Marketplace Commission Revenue',
    type: 'REVENUE' as const,
    currency: 'INR',
    description: 'Platform commissions earned from completed orders',
  },
  {
    code: '5010_GATEWAY_FEES',
    name: 'Payment Gateway Processing Expense',
    type: 'EXPENSE' as const,
    currency: 'INR',
    description: 'Third-party processor processing fees',
  },
];

type DbTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];
type DbClient = DatabaseService['db'] | DbTransaction;

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  private accountIdCache: Map<string, string> = new Map();

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Ensures standard Chart of Accounts exists in the database.
   */
  async ensureAccountsExist(txOrDb?: DbClient): Promise<void> {
    const client = txOrDb || this.databaseService.db;
    const existing = await client
      .select({
        id: this.databaseService.schema.ledgerAccounts.id,
        code: this.databaseService.schema.ledgerAccounts.code,
      })
      .from(this.databaseService.schema.ledgerAccounts);

    for (const acc of existing) {
      this.accountIdCache.set(acc.code, acc.id);
    }

    for (const std of STANDARD_CHART_OF_ACCOUNTS) {
      if (!this.accountIdCache.has(std.code)) {
        const [inserted] = await client
          .insert(this.databaseService.schema.ledgerAccounts)
          .values(std)
          .onConflictDoNothing()
          .returning();
        if (inserted) {
          this.accountIdCache.set(std.code, inserted.id);
        } else {
          // Re-query if conflict
          const [found] = await client
            .select({ id: this.databaseService.schema.ledgerAccounts.id })
            .from(this.databaseService.schema.ledgerAccounts)
            .where(eq(this.databaseService.schema.ledgerAccounts.code, std.code))
            .limit(1);
          if (found) {
            this.accountIdCache.set(std.code, found.id);
          }
        }
      }
    }
  }

  /**
   * Resolves account UUID by its human-readable chart code.
   */
  async getAccountIdByCode(code: string, txOrDb?: DbClient): Promise<string> {
    if (this.accountIdCache.has(code)) {
      return this.accountIdCache.get(code)!;
    }

    await this.ensureAccountsExist(txOrDb);
    const id = this.accountIdCache.get(code);
    if (!id) {
      throw new BadRequestException(
        `Ledger Account with code "${code}" does not exist in Chart of Accounts`,
      );
    }
    return id;
  }

  /**
   * Posts an append-only double-entry journal batch.
   *
   * Strictly enforces the Double-Entry Balance Invariant:
   * sum(Debits) === sum(Credits)
   * Throws BadRequestException and rolls back if unbalanced.
   */
  async postBalancedJournalBatch(
    params: PostJournalBatchParams,
    txOrDb?: DbClient,
  ): Promise<{ journalBatchId: string; entriesCount: number }> {
    const { entries } = params;

    if (!entries || entries.length < 2) {
      throw new BadRequestException(
        'Journal batch must contain at least 2 balancing ledger entries',
      );
    }

    // Validate non-negative amounts
    for (const e of entries) {
      if (e.amountMinor <= 0) {
        throw new BadRequestException(
          `Invalid ledger entry amount: ${e.amountMinor}. Must be positive.`,
        );
      }
    }

    // Compute sums
    const totalDebits = entries
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((acc, e) => acc + e.amountMinor, 0);

    const totalCredits = entries
      .filter((e) => e.entryType === 'CREDIT')
      .reduce((acc, e) => acc + e.amountMinor, 0);

    if (totalDebits !== totalCredits) {
      const err = `UNBALANCED_JOURNAL_BATCH: Total Debits (${totalDebits}) does not equal Total Credits (${totalCredits})`;
      this.logger.error(err);
      throw new BadRequestException(err);
    }

    const journalBatchId = params.journalBatchId ?? randomUUID();
    const client = txOrDb || this.databaseService.db;

    // Resolve all account IDs
    await this.ensureAccountsExist(client);

    for (const entry of entries) {
      const accountId = await this.getAccountIdByCode(entry.accountCode, client);

      await client.insert(this.databaseService.schema.ledgerEntries).values({
        journalBatchId,
        accountId,
        sellerId: entry.sellerId ?? null,
        subOrderId: entry.subOrderId ?? null,
        payoutBatchId: entry.payoutBatchId ?? null,
        entryType: entry.entryType,
        amountMinor: entry.amountMinor,
        currency: entry.currency ?? 'INR',
        description: entry.description,
      });
    }

    this.logger.log(
      `Posted balanced journal batch ${journalBatchId} (${entries.length} entries, balance = ${totalDebits} paise)`,
    );

    return { journalBatchId, entriesCount: entries.length };
  }

  /**
   * Credits artisan pending escrow balance upon authoritative payment capture.
   */
  async creditSellerEscrow(
    sellerId: string,
    amountMinor: number,
    txOrDb?: DbClient,
  ): Promise<void> {
    const client = txOrDb || this.databaseService.db;

    const [existing] = await client
      .select()
      .from(this.databaseService.schema.sellerBalances)
      .where(eq(this.databaseService.schema.sellerBalances.sellerId, sellerId))
      .limit(1);

    if (!existing) {
      await client.insert(this.databaseService.schema.sellerBalances).values({
        sellerId,
        pendingEscrowMinor: amountMinor,
        availablePayoutMinor: 0,
        heldDisputeMinor: 0,
        lifetimePayoutMinor: 0,
        currency: 'INR',
      });
    } else {
      await client
        .update(this.databaseService.schema.sellerBalances)
        .set({
          pendingEscrowMinor: sql`${this.databaseService.schema.sellerBalances.pendingEscrowMinor} + ${amountMinor}`,
          updatedAt: new Date(),
        })
        .where(eq(this.databaseService.schema.sellerBalances.sellerId, sellerId));
    }
  }

  /**
   * Debits artisan pending escrow balance upon return/refund.
   */
  async debitSellerEscrow(sellerId: string, amountMinor: number, txOrDb?: DbClient): Promise<void> {
    const client = txOrDb || this.databaseService.db;

    const [existing] = await client
      .select()
      .from(this.databaseService.schema.sellerBalances)
      .where(eq(this.databaseService.schema.sellerBalances.sellerId, sellerId))
      .limit(1);

    if (!existing || existing.pendingEscrowMinor < amountMinor) {
      throw new BadRequestException(
        `Insufficient pending escrow balance for seller ${sellerId}. Available: ${existing?.pendingEscrowMinor ?? 0}, Requested: ${amountMinor}`,
      );
    }

    await client
      .update(this.databaseService.schema.sellerBalances)
      .set({
        pendingEscrowMinor: sql`${this.databaseService.schema.sellerBalances.pendingEscrowMinor} - ${amountMinor}`,
        updatedAt: new Date(),
      })
      .where(eq(this.databaseService.schema.sellerBalances.sellerId, sellerId));
  }

  /**
   * Retrieves materialized financial balance statement for an artisan seller.
   */
  async getSellerBalance(sellerId: string): Promise<SellerBalanceStatementDto> {
    const [balance] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerBalances)
      .where(eq(this.databaseService.schema.sellerBalances.sellerId, sellerId))
      .limit(1);

    if (!balance) {
      return {
        sellerId,
        currency: 'INR',
        availablePayoutMinor: 0,
        pendingEscrowMinor: 0,
        heldDisputeMinor: 0,
        lifetimePayoutMinor: 0,
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      sellerId: balance.sellerId,
      currency: balance.currency,
      availablePayoutMinor: balance.availablePayoutMinor,
      pendingEscrowMinor: balance.pendingEscrowMinor,
      heldDisputeMinor: balance.heldDisputeMinor,
      lifetimePayoutMinor: balance.lifetimePayoutMinor,
      updatedAt: balance.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves chronological ledger journal entries for a seller.
   */
  async getSellerLedgerEntries(
    sellerId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<LedgerEntryDto[]> {
    const rows = await this.databaseService.db
      .select({
        entry: this.databaseService.schema.ledgerEntries,
        account: this.databaseService.schema.ledgerAccounts,
      })
      .from(this.databaseService.schema.ledgerEntries)
      .innerJoin(
        this.databaseService.schema.ledgerAccounts,
        eq(
          this.databaseService.schema.ledgerEntries.accountId,
          this.databaseService.schema.ledgerAccounts.id,
        ),
      )
      .where(eq(this.databaseService.schema.ledgerEntries.sellerId, sellerId))
      .orderBy(desc(this.databaseService.schema.ledgerEntries.postedAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.entry.id,
      journalBatchId: r.entry.journalBatchId,
      accountCode: r.account.code,
      accountName: r.account.name,
      entryType: r.entry.entryType,
      amountMinor: r.entry.amountMinor,
      currency: r.entry.currency,
      description: r.entry.description,
      sellerId: r.entry.sellerId,
      subOrderId: r.entry.subOrderId,
      postedAt: r.entry.postedAt.toISOString(),
    }));
  }
}

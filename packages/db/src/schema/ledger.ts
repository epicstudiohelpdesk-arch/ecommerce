import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  index,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { sellerProfiles, payoutAccounts } from './sellers.js';
import { subOrders } from './orders.js';

// Enums
export const ledgerAccountTypeEnum = pgEnum('ledger_account_type', [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
]);

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', ['DEBIT', 'CREDIT']);

export const payoutBatchStatusEnum = pgEnum('payout_batch_status', [
  'PENDING',
  'SUBMITTED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'PARTIALLY_SETTLED',
]);

export const payoutTransactionStatusEnum = pgEnum('payout_transaction_status', [
  'PENDING',
  'SUBMITTED',
  'SUCCEEDED',
  'FAILED',
]);

// 1. Chart of Accounts
export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    type: ledgerAccountTypeEnum('type').notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ledger_accounts_code').on(table.code),
    index('idx_ledger_accounts_type').on(table.type),
  ],
);

// 2. Append-Only Financial Ledger Entries (Double-Entry Bookkeeping)
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    journalBatchId: uuid('journal_batch_id').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: 'restrict' }),
    sellerId: uuid('seller_id').references(() => sellerProfiles.id, {
      onDelete: 'restrict',
    }),
    subOrderId: uuid('sub_order_id').references(() => subOrders.id, {
      onDelete: 'restrict',
    }),
    payoutBatchId: uuid('payout_batch_id'),
    entryType: ledgerEntryTypeEnum('entry_type').notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ledger_journal_batch').on(table.journalBatchId),
    index('idx_ledger_account').on(table.accountId),
    index('idx_ledger_seller').on(table.sellerId),
    index('idx_ledger_sub_order').on(table.subOrderId),
    index('idx_ledger_posted_at').on(table.postedAt),
    check('chk_ledger_amount_positive', sql`${table.amountMinor} > 0`),
  ],
);

// 3. Seller Balances (Materialized projection of ledger state)
export const sellerBalances = pgTable(
  'seller_balances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .unique()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    pendingEscrowMinor: bigint('pending_escrow_minor', { mode: 'number' }).default(0).notNull(),
    availablePayoutMinor: bigint('available_payout_minor', { mode: 'number' }).default(0).notNull(),
    heldDisputeMinor: bigint('held_dispute_minor', { mode: 'number' }).default(0).notNull(),
    lifetimePayoutMinor: bigint('lifetime_payout_minor', { mode: 'number' }).default(0).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_seller_balances_seller').on(table.sellerId),
    check('chk_balances_pending_escrow', sql`${table.pendingEscrowMinor} >= 0`),
    check('chk_balances_available_payout', sql`${table.availablePayoutMinor} >= 0`),
    check('chk_balances_held_dispute', sql`${table.heldDisputeMinor} >= 0`),
    check('chk_balances_lifetime_payout', sql`${table.lifetimePayoutMinor} >= 0`),
  ],
);

// 4. Payout Batches
export const payoutBatches = pgTable(
  'payout_batches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchNumber: varchar('batch_number', { length: 60 }).notNull().unique(),
    status: payoutBatchStatusEnum('status').default('PENDING').notNull(),
    totalAmountMinor: bigint('total_amount_minor', { mode: 'number' }).notNull(),
    totalRecipients: integer('total_recipients').notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    initiatedBy: uuid('initiated_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    authorizedBy: uuid('authorized_by').references(() => users.id, {
      onDelete: 'restrict',
    }), // Dual-approval enforcement
    executedAt: timestamp('executed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payout_batches_status').on(table.status),
    check('chk_payout_batches_amount', sql`${table.totalAmountMinor} > 0`),
    check('chk_payout_batches_recipients', sql`${table.totalRecipients} > 0`),
  ],
);

// 5. Payout Transactions
export const payoutTransactions = pgTable(
  'payout_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => payoutBatches.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'restrict' }),
    payoutAccountId: uuid('payout_account_id')
      .notNull()
      .references(() => payoutAccounts.id, { onDelete: 'restrict' }),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    status: payoutTransactionStatusEnum('status').default('PENDING').notNull(),
    providerTransferId: varchar('provider_transfer_id', { length: 255 }).unique(),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payout_tx_batch').on(table.batchId),
    index('idx_payout_tx_seller').on(table.sellerId),
    index('idx_payout_tx_status').on(table.status),
    check('chk_payout_tx_amount', sql`${table.amountMinor} > 0`),
  ],
);

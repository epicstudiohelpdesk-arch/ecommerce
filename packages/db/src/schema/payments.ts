import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  bigint,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { customerOrders, subOrders } from './orders.js';

// Enums
export const paymentProviderEnum = pgEnum('payment_provider', [
  'STRIPE',
  'RAZORPAY',
  'MOCK_PROVIDER',
]);

export const paymentAttemptStatusEnum = pgEnum('payment_attempt_status', [
  'INITIATED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
]);

export const refundReasonEnum = pgEnum('refund_reason', [
  'CUSTOMER_CANCELLATION',
  'DEFECTIVE_ITEM',
  'ITEM_NOT_RECEIVED',
  'SELLER_UNFULFILLED',
  'DISPUTE_RESOLUTION',
]);

export const refundStatusEnum = pgEnum('refund_status', [
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
]);

// 1. Payment Attempts
export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentOrderId: uuid('parent_order_id')
      .notNull()
      .references(() => customerOrders.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    providerIntentId: varchar('provider_intent_id', { length: 255 }).notNull().unique(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    status: paymentAttemptStatusEnum('status').default('INITIATED').notNull(),
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payment_attempts_parent').on(table.parentOrderId),
    index('idx_payment_attempts_status').on(table.status),
    index('idx_payment_attempts_idempotency').on(table.idempotencyKey),
    check('chk_payment_attempt_amount', sql`${table.amountMinor} > 0`),
  ],
);

// 2. Payment Allocations (Partitions customer payment capture to autonomous sub-orders)
export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentAttemptId: uuid('payment_attempt_id')
      .notNull()
      .references(() => paymentAttempts.id, { onDelete: 'cascade' }),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .references(() => subOrders.id, { onDelete: 'restrict' }),
    allocatedAmountMinor: bigint('allocated_amount_minor', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_allocations_payment_attempt').on(table.paymentAttemptId),
    index('idx_allocations_sub_order').on(table.subOrderId),
    check('chk_allocations_amount_positive', sql`${table.allocatedAmountMinor} > 0`),
  ],
);

// 3. Payment Webhook Events (Idempotency and deduplication)
export const paymentWebhookEvents = pgTable(
  'payment_webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: paymentProviderEnum('provider').notNull(),
    eventId: varchar('event_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    processed: boolean('processed').default(false).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_webhook_provider_event').on(table.provider, table.eventId),
    index('idx_webhook_processed').on(table.processed),
  ],
);

// 4. Refund Requests
export const refundRequests = pgTable(
  'refund_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .references(() => subOrders.id, { onDelete: 'restrict' }),
    paymentAttemptId: uuid('payment_attempt_id')
      .notNull()
      .references(() => paymentAttempts.id, { onDelete: 'restrict' }),
    refundNumber: varchar('refund_number', { length: 60 }).notNull().unique(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    reason: refundReasonEnum('reason').notNull(),
    status: refundStatusEnum('status').default('REQUESTED').notNull(),
    providerRefundId: varchar('provider_refund_id', { length: 255 }).unique(),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_refunds_sub_order').on(table.subOrderId),
    index('idx_refunds_status').on(table.status),
    check('chk_refunds_amount_positive', sql`${table.amountMinor} > 0`),
  ],
);

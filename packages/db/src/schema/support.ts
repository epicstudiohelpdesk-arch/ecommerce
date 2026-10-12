import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  smallint,
  bigint,
  index,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { products } from './catalog.js';
import { subOrders, orderItems } from './orders.js';
import { sellerProfiles } from './sellers.js';

// Enums
export const reviewModerationStatusEnum = pgEnum('review_moderation_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const supportCategoryEnum = pgEnum('support_category', [
  'ORDER_ISSUE',
  'PAYMENT_DISPUTE',
  'SHIPPING_DELAY',
  'SELLER_VERIFICATION',
  'GENERAL_INQUIRY',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_USER',
  'RESOLVED',
  'CLOSED',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const disputeReasonEnum = pgEnum('dispute_reason', [
  'DAMAGED_HANDMADE_GOOD',
  'NOT_AS_DESCRIBED',
  'NOT_DELIVERED',
  'UNAUTHORIZED_RETURN_REJECTION',
]);

export const disputeStatusEnum = pgEnum('dispute_status', [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'CLOSED',
]);

export const disputeResolutionEnum = pgEnum('dispute_resolution', [
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'REJECTED',
  'SELLER_FAVORED',
]);

// 1. Product Reviews (Strictly requires verified order item purchase)
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id')
      .notNull()
      .unique()
      .references(() => orderItems.id, { onDelete: 'restrict' }), // Verified purchase guarantee
    rating: smallint('rating').notNull(),
    title: varchar('title', { length: 150 }),
    comment: text('comment'),
    imageUrls: text('image_urls').array(),
    moderationStatus: reviewModerationStatusEnum('moderation_status').default('PENDING').notNull(),
    sellerReply: text('seller_reply'),
    sellerRepliedAt: timestamp('seller_replied_at', {
      withTimezone: true,
      mode: 'date',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_reviews_product').on(table.productId),
    index('idx_reviews_customer').on(table.customerId),
    index('idx_reviews_status').on(table.moderationStatus),
    check('chk_reviews_rating_range', sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  ],
);

// 2. Support Tickets
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketNumber: varchar('ticket_number', { length: 50 }).notNull().unique(),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignedAgentId: uuid('assigned_agent_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    category: supportCategoryEnum('category').notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    description: text('description').notNull(),
    status: ticketStatusEnum('status').default('OPEN').notNull(),
    priority: ticketPriorityEnum('priority').default('MEDIUM').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_support_tickets_creator').on(table.creatorId),
    index('idx_support_tickets_status').on(table.status),
    index('idx_support_tickets_agent').on(table.assignedAgentId),
  ],
);

// 3. Disputes (Escalations for artisan items)
export const disputes = pgTable(
  'disputes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    disputeNumber: varchar('dispute_number', { length: 50 }).notNull().unique(),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .references(() => subOrders.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'restrict' }),
    reason: disputeReasonEnum('reason').notNull(),
    claimedAmountMinor: bigint('claimed_amount_minor', { mode: 'number' }).notNull(),
    status: disputeStatusEnum('status').default('OPEN').notNull(),
    resolution: disputeResolutionEnum('resolution'),
    resolvedBy: uuid('resolved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_disputes_sub_order').on(table.subOrderId),
    index('idx_disputes_seller').on(table.sellerId),
    index('idx_disputes_customer').on(table.customerId),
    index('idx_disputes_status').on(table.status),
    check('chk_disputes_amount_positive', sql`${table.claimedAmountMinor} > 0`),
  ],
);

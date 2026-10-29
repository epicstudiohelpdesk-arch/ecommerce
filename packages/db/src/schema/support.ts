import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  smallint,
  bigint,
  jsonb,
  index,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { products } from './catalog.js';
import { customerOrders, subOrders, orderItems } from './orders.js';
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

export const policyTargetTypeEnum = pgEnum('policy_target_type', ['PRODUCT', 'SELLER', 'REVIEW']);

export const policyReportReasonEnum = pgEnum('policy_report_reason', [
  'MISLEADING_INFO',
  'NOT_HANDMADE',
  'PROHIBITED_ITEM',
  'COPYRIGHT_INFRINGEMENT',
  'ABUSIVE_BEHAVIOR',
  'OTHER',
]);

export const policyReportStatusEnum = pgEnum('policy_report_status', [
  'PENDING_REVIEW',
  'INVESTIGATING',
  'ACTION_TAKEN',
  'DISMISSED',
]);

export const policyReportActionEnum = pgEnum('policy_report_action', [
  'NO_ACTION',
  'WARNING_ISSUED',
  'LISTING_REMOVED',
  'SELLER_SUSPENDED',
]);

export const riskEntityTypeEnum = pgEnum('risk_entity_type', ['USER', 'ORDER', 'SELLER']);

export const riskSignalTypeEnum = pgEnum('risk_signal_type', [
  'VELOCITY_PAYMENT_FAILURE',
  'SUSPICIOUS_CHECKOUT',
  'DUPLICATE_DISPUTES',
  'FULFILMENT_ANOMALY',
  'MANUAL_SECURITY_FLAG',
]);

export const riskLevelEnum = pgEnum('risk_level', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const riskCaseStatusEnum = pgEnum('risk_case_status', [
  'OPEN',
  'UNDER_INVESTIGATION',
  'MITIGATED',
  'DISMISSED',
]);

export const riskActionTakenEnum = pgEnum('risk_action_taken', [
  'NONE',
  'TRANSACTION_FLAGGED',
  'SELLER_HOLD_REQUESTED',
  'ACCOUNT_RESTRICTED',
]);

export const privacyRequestTypeEnum = pgEnum('privacy_request_type', [
  'DATA_ACCESS',
  'DATA_CORRECTION',
  'ACCOUNT_DELETION',
  'CONSENT_WITHDRAWAL',
]);

export const privacyRequestStatusEnum = pgEnum('privacy_request_status', [
  'SUBMITTED',
  'IN_REVIEW',
  'COMPLETED',
  'REJECTED',
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
    orderId: uuid('order_id').references(() => customerOrders.id, { onDelete: 'set null' }),
    subOrderId: uuid('sub_order_id').references(() => subOrders.id, { onDelete: 'set null' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    escalated: boolean('escalated').default(false).notNull(),
    escalationReason: text('escalation_reason'),
    resolutionNotes: text('resolution_notes'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_support_tickets_creator').on(table.creatorId),
    index('idx_support_tickets_status').on(table.status),
    index('idx_support_tickets_agent').on(table.assignedAgentId),
    index('idx_support_tickets_order').on(table.orderId),
  ],
);

// 3. Support Ticket Messages / Conversation & Internal Notes
export const supportTicketMessages = pgTable(
  'support_ticket_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    senderRole: varchar('sender_role', { length: 50 }).notNull(),
    message: text('message').notNull(),
    isInternal: boolean('is_internal').default(false).notNull(),
    attachments: jsonb('attachments')
      .default(sql`'[]'::jsonb`)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ticket_messages_ticket').on(table.ticketId),
    index('idx_ticket_messages_created').on(table.createdAt),
  ],
);

// 4. Disputes (Escalations for artisan items)
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
    customerNotes: text('customer_notes'),
    sellerNotes: text('seller_notes'),
    evidenceUrls: text('evidence_urls').array(),
    resolutionNotes: text('resolution_notes'),
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

// 5. Policy Reports (Product, seller, or review policy violation reporting)
export const policyReports = pgTable(
  'policy_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportNumber: varchar('report_number', { length: 50 }).notNull().unique(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: policyTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: policyReportReasonEnum('reason').notNull(),
    description: text('description').notNull(),
    evidenceUrls: text('evidence_urls').array(),
    status: policyReportStatusEnum('status').default('PENDING_REVIEW').notNull(),
    assignedReviewerId: uuid('assigned_reviewer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewNotes: text('review_notes'),
    actionTaken: policyReportActionEnum('action_taken').default('NO_ACTION').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_policy_reports_status').on(table.status),
    index('idx_policy_reports_target').on(table.targetType, table.targetId),
    index('idx_policy_reports_reporter').on(table.reporterId),
  ],
);

// 6. Suspicious-Activity and Risk Cases
export const riskCases = pgTable(
  'risk_cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseNumber: varchar('case_number', { length: 50 }).notNull().unique(),
    entityType: riskEntityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    signalType: riskSignalTypeEnum('signal_type').notNull(),
    riskLevel: riskLevelEnum('risk_level').default('MEDIUM').notNull(),
    status: riskCaseStatusEnum('status').default('OPEN').notNull(),
    assignedInvestigatorId: uuid('assigned_investigator_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    evidenceSnapshot: jsonb('evidence_snapshot'),
    internalNotes: text('internal_notes'),
    actionTaken: riskActionTakenEnum('action_taken').default('NONE').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_risk_cases_status').on(table.status),
    index('idx_risk_cases_level').on(table.riskLevel),
    index('idx_risk_cases_entity').on(table.entityType, table.entityId),
  ],
);

// 7. Privacy and Compliance Requests (DPDP Act / GDPR data subject requests)
export const privacyRequests = pgTable(
  'privacy_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestNumber: varchar('request_number', { length: 50 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    requestType: privacyRequestTypeEnum('request_type').notNull(),
    status: privacyRequestStatusEnum('status').default('SUBMITTED').notNull(),
    reason: text('reason'),
    reviewNotes: text('review_notes'),
    retentionExemptions: text('retention_exemptions'),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_privacy_requests_user').on(table.userId),
    index('idx_privacy_requests_status').on(table.status),
    index('idx_privacy_requests_type').on(table.requestType),
  ],
);

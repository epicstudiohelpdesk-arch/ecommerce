import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { subOrders } from './orders.js';

// Enums
export const shipmentStatusEnum = pgEnum('shipment_status', [
  'LABEL_CREATED',
  'PICKUP_SCHEDULED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RTO_INITIATED',
  'RTO_DELIVERED',
]);

export const returnStatusEnum = pgEnum('return_status', [
  'REQUESTED',
  'APPROVED',
  'ITEM_SHIPPED',
  'ITEM_RECEIVED',
  'REFUNDED',
  'REJECTED',
]);

// 1. Shipments Table
export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .unique()
      .references(() => subOrders.id, { onDelete: 'restrict' }),
    courierCode: varchar('courier_code', { length: 50 }).notNull(),
    trackingNumber: varchar('tracking_number', { length: 100 }).notNull(),
    waybillNumber: varchar('waybill_number', { length: 100 }),
    labelUrl: varchar('label_url', { length: 500 }),
    status: shipmentStatusEnum('status').default('LABEL_CREATED').notNull(),
    weightGrams: integer('weight_grams').notNull(),
    lengthMm: integer('length_mm').notNull(),
    widthMm: integer('width_mm').notNull(),
    heightMm: integer('height_mm').notNull(),
    shippedAt: timestamp('shipped_at', { withTimezone: true, mode: 'date' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_shipments_sub_order').on(table.subOrderId),
    index('idx_shipments_tracking').on(table.trackingNumber),
    index('idx_shipments_status').on(table.status),
    check('chk_shipments_weight', sql`${table.weightGrams} > 0`),
    check(
      'chk_shipments_dimensions',
      sql`${table.lengthMm} > 0 AND ${table.widthMm} > 0 AND ${table.heightMm} > 0`,
    ),
  ],
);

// 2. Shipment Milestones (Tracking checkpoints from couriers)
export const shipmentMilestones = pgTable(
  'shipment_milestones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    status: shipmentStatusEnum('status').notNull(),
    location: varchar('location', { length: 150 }),
    description: text('description').notNull(),
    eventTime: timestamp('event_time', { withTimezone: true, mode: 'date' }).notNull(),
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_milestones_shipment').on(table.shipmentId),
    index('idx_milestones_event_time').on(table.eventTime),
  ],
);

// 3. Return Requests
export const returnRequests = pgTable(
  'return_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .references(() => subOrders.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: returnStatusEnum('status').default('REQUESTED').notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    proofImageUrls: text('proof_image_urls').array(),
    sellerNotes: text('seller_notes'),
    trackingNumber: varchar('tracking_number', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_returns_sub_order').on(table.subOrderId),
    index('idx_returns_customer').on(table.customerId),
    index('idx_returns_status').on(table.status),
  ],
);

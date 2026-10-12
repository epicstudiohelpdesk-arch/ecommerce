import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  jsonb,
  index,
  unique,
  pgEnum,
  check,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { sellerProfiles, shops } from './sellers.js';
import { productVariants } from './catalog.js';

// Enums
export const orderPaymentStatusEnum = pgEnum('order_payment_status', [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'REFUNDED',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'PLACED',
  'PROCESSING',
  'PARTIALLY_SHIPPED',
  'COMPLETED',
  'CANCELLED',
]);

export const subOrderStatusEnum = pgEnum('sub_order_status', [
  'CONFIRMED',
  'IN_PRODUCTION',
  'READY_FOR_PICKUP',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'RETURNED',
]);

// 1. Parent Customer Orders (Aggregates multi-vendor checkout transaction)
export const customerOrders = pgTable(
  'customer_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    totalAmountMinor: bigint('total_amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    paymentStatus: orderPaymentStatusEnum('payment_status').default('PENDING').notNull(),
    orderStatus: orderStatusEnum('order_status').default('PLACED').notNull(),
    shippingAddress: jsonb('shipping_address').notNull(),
    billingAddress: jsonb('billing_address').notNull(),
    customerNote: text('customer_note'),
    placedAt: timestamp('placed_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_orders_customer').on(table.customerId),
    index('idx_orders_status').on(table.orderStatus),
    index('idx_orders_payment_status').on(table.paymentStatus),
    index('idx_orders_placed_at').on(table.placedAt),
    check('chk_orders_total_positive', sql`${table.totalAmountMinor} >= 0`),
  ],
);

// 2. Sub-Orders (Artisan-specific autonomous fulfillment contract)
export const subOrders = pgTable(
  'sub_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subOrderNumber: varchar('sub_order_number', { length: 60 }).notNull().unique(),
    parentOrderId: uuid('parent_order_id')
      .notNull()
      .references(() => customerOrders.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'restrict' }),
    shopId: uuid('shop_id')
      .notNull()
      .references(() => shops.id, { onDelete: 'restrict' }),
    status: subOrderStatusEnum('status').default('CONFIRMED').notNull(),
    itemSubtotalMinor: bigint('item_subtotal_minor', { mode: 'number' }).notNull(),
    shippingFeeMinor: bigint('shipping_fee_minor', { mode: 'number' }).notNull(),
    commissionRateBps: integer('commission_rate_bps').notNull(),
    commissionFeeMinor: bigint('commission_fee_minor', { mode: 'number' }).notNull(),
    taxMinor: bigint('tax_minor', { mode: 'number' }).default(0).notNull(),
    netSellerPayableMinor: bigint('net_seller_payable_minor', {
      mode: 'number',
    }).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    cancellationReason: text('cancellation_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sub_orders_parent').on(table.parentOrderId),
    index('idx_sub_orders_seller').on(table.sellerId),
    index('idx_sub_orders_shop').on(table.shopId),
    index('idx_sub_orders_status').on(table.status),
    // Composite unique constraint for composite FK from order_items (guarantees seller isolation)
    unique('uq_sub_orders_id_seller').on(table.id, table.sellerId),
    check('chk_sub_orders_item_subtotal', sql`${table.itemSubtotalMinor} >= 0`),
    check('chk_sub_orders_shipping_fee', sql`${table.shippingFeeMinor} >= 0`),
    check('chk_sub_orders_commission_fee', sql`${table.commissionFeeMinor} >= 0`),
    check('chk_sub_orders_net_payable', sql`${table.netSellerPayableMinor} >= 0`),
  ],
);

// 3. Order Items (Snapshot of purchased items)
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subOrderId: uuid('sub_order_id').notNull(),
    sellerId: uuid('seller_id').notNull(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    titleSnapshot: varchar('title_snapshot', { length: 255 }).notNull(),
    skuSnapshot: varchar('sku_snapshot', { length: 100 }).notNull(),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }).notNull(),
    quantity: integer('quantity').notNull(),
    totalPriceMinor: bigint('total_price_minor', { mode: 'number' }).notNull(),
    customizationInput: text('customization_input'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_order_items_sub_order').on(table.subOrderId),
    index('idx_order_items_seller').on(table.sellerId),
    index('idx_order_items_variant').on(table.variantId),
    // Composite foreign key to sub_orders (id, seller_id) guarantees an item cannot be attached to another seller's suborder
    foreignKey({
      columns: [table.subOrderId, table.sellerId],
      foreignColumns: [subOrders.id, subOrders.sellerId],
      name: 'fk_order_items_sub_order_seller',
    }).onDelete('cascade'),
    check('chk_order_items_quantity', sql`${table.quantity} > 0`),
    check('chk_order_items_unit_price', sql`${table.unitPriceMinor} >= 0`),
    check(
      'chk_order_items_total_price',
      sql`${table.totalPriceMinor} = ${table.unitPriceMinor} * ${table.quantity}`,
    ),
  ],
);

// 4. Order Timeline Events (Append-only lifecycle events)
export const orderTimelineEvents = pgTable(
  'order_timeline_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subOrderId: uuid('sub_order_id')
      .notNull()
      .references(() => subOrders.id, { onDelete: 'cascade' }),
    fromStatus: varchar('from_status', { length: 50 }),
    toStatus: varchar('to_status', { length: 50 }).notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_order_timeline_sub_order').on(table.subOrderId),
    index('idx_order_timeline_created_at').on(table.createdAt),
  ],
);

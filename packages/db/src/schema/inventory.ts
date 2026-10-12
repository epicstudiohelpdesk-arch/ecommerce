import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  index,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { productVariants } from './catalog.js';

// Enums
export const reservationStatusEnum = pgEnum('reservation_status', [
  'ACTIVE',
  'COMMITTED',
  'RELEASED',
  'EXPIRED',
]);

export const stockAdjustmentReasonEnum = pgEnum('stock_adjustment_reason', [
  'MANUAL_CORRECTION',
  'RECEIPT',
  'BREAKAGE',
  'SALE_COMMITTED',
  'RETURN_RESTOCK',
  'AUDIT_DISCREPANCY',
]);

// 1. Inventory Items (Physical or virtual on-hand tracking per variant)
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    variantId: uuid('variant_id')
      .notNull()
      .unique()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
    quantityReserved: integer('quantity_reserved').default(0).notNull(),
    lowStockThreshold: integer('low_stock_threshold').default(2).notNull(),
    isUnlimited: boolean('is_unlimited').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_inventory_variant').on(table.variantId),
    check('chk_inventory_on_hand_positive', sql`${table.quantityOnHand} >= 0`),
    check('chk_inventory_reserved_positive', sql`${table.quantityReserved} >= 0`),
    check(
      'chk_inventory_reserved_le_on_hand',
      sql`${table.quantityReserved} <= ${table.quantityOnHand}`,
    ),
  ],
);

// 2. Inventory Reservations (Atomic stock holding with 15-minute TTL)
export const inventoryReservations = pgTable(
  'inventory_reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    cartId: uuid('cart_id'),
    checkoutId: varchar('checkout_id', { length: 100 }),
    quantity: integer('quantity').notNull(),
    status: reservationStatusEnum('status').default('ACTIVE').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    committedAt: timestamp('committed_at', { withTimezone: true, mode: 'date' }),
    releasedAt: timestamp('released_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_reservations_variant').on(table.variantId),
    index('idx_reservations_status_expires').on(table.status, table.expiresAt),
    index('idx_reservations_checkout').on(table.checkoutId),
    check('chk_reservation_quantity_positive', sql`${table.quantity} > 0`),
  ],
);

// 3. Stock Adjustments (Auditable adjustments log)
export const stockAdjustments = pgTable(
  'stock_adjustments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantityDelta: integer('quantity_delta').notNull(),
    reason: stockAdjustmentReasonEnum('reason').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_stock_adjustments_variant').on(table.variantId),
    index('idx_stock_adjustments_created_at').on(table.createdAt),
  ],
);

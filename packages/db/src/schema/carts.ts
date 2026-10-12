import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { sellerProfiles } from './sellers.js';
import { productVariants } from './catalog.js';

// Enums
export const discountTypeEnum = pgEnum('discount_type', ['PERCENTAGE', 'FIXED_AMOUNT']);
export const couponFundedByEnum = pgEnum('coupon_funded_by', ['PLATFORM', 'SELLER']);

// 1. Carts Table
export const carts = pgTable(
  'carts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionId: varchar('session_id', { length: 100 }),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_carts_customer').on(table.customerId),
    index('idx_carts_session').on(table.sessionId),
    index('idx_carts_expires').on(table.expiresAt),
  ],
);

// 2. Cart Items Table
export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').default(1).notNull(),
    customizationText: text('customization_text'),
    customizationOptions: jsonb('customization_options'),
    priceSnapshotMinor: bigint('price_snapshot_minor', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_cart_items_cart').on(table.cartId),
    uniqueIndex('idx_cart_items_unique_variant').on(table.cartId, table.variantId),
    check('chk_cart_items_quantity', sql`${table.quantity} > 0`),
    check('chk_cart_items_price', sql`${table.priceSnapshotMinor} >= 0`),
  ],
);

// 3. Coupons / Promotions Table
export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id').references(() => sellerProfiles.id, {
      onDelete: 'cascade',
    }),
    code: varchar('code', { length: 50 }).notNull().unique(),
    discountType: discountTypeEnum('discount_type').notNull(),
    discountValue: integer('discount_value').notNull(), // bps for PERCENTAGE, minor amount for FIXED_AMOUNT
    minOrderMinor: bigint('min_order_minor', { mode: 'number' }).default(0).notNull(),
    maxDiscountMinor: bigint('max_discount_minor', { mode: 'number' }),
    fundedBy: couponFundedByEnum('funded_by').default('PLATFORM').notNull(),
    usageLimit: integer('usage_limit'),
    timesUsed: integer('times_used').default(0).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_coupons_code').on(table.code),
    index('idx_coupons_seller').on(table.sellerId),
    check('chk_coupons_discount_value', sql`${table.discountValue} > 0`),
    check('chk_coupons_min_order', sql`${table.minOrderMinor} >= 0`),
    check('chk_coupons_times_used', sql`${table.timesUsed} >= 0`),
  ],
);

// 4. Immutable Checkout Pricing Snapshots
export const pricingSnapshots = pgTable(
  'pricing_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    checkoutId: varchar('checkout_id', { length: 100 }).notNull().unique(),
    subtotalMinor: bigint('subtotal_minor', { mode: 'number' }).notNull(),
    shippingTotalMinor: bigint('shipping_total_minor', { mode: 'number' }).notNull(),
    discountTotalMinor: bigint('discount_total_minor', { mode: 'number' }).default(0).notNull(),
    taxTotalMinor: bigint('tax_total_minor', { mode: 'number' }).default(0).notNull(),
    grandTotalMinor: bigint('grand_total_minor', { mode: 'number' }).notNull(),
    breakdownJson: jsonb('breakdown_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_pricing_snapshots_checkout').on(table.checkoutId),
    check('chk_pricing_subtotal', sql`${table.subtotalMinor} >= 0`),
    check('chk_pricing_shipping', sql`${table.shippingTotalMinor} >= 0`),
    check('chk_pricing_grand_total', sql`${table.grandTotalMinor} >= 0`),
  ],
);

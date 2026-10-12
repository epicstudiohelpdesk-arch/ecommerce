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
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';
import { sellerProfiles } from './sellers.js';

// Enums
export const productTypeEnum = pgEnum('product_type', [
  'READY_TO_SHIP',
  'ONE_OF_A_KIND',
  'MADE_TO_ORDER',
  'PERSONALIZED',
]);

export const productModerationStatusEnum = pgEnum('product_moderation_status', [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
  'SUSPENDED',
]);

export const mediaTypeEnum = pgEnum('media_type', ['IMAGE', 'VIDEO']);

// 1. Categories
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id'),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    imageUrl: varchar('image_url', { length: 500 }),
    commissionRateBps: integer('commission_rate_bps'),
    isActive: boolean('is_active').default(true).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_categories_parent').on(table.parentId),
    index('idx_categories_slug').on(table.slug),
    check(
      'chk_category_commission_bps',
      sql`${table.commissionRateBps} IS NULL OR (${table.commissionRateBps} >= 0 AND ${table.commissionRateBps} <= 10000)`,
    ),
  ],
);

// 2. Products
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    productType: productTypeEnum('product_type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    shortDescription: varchar('short_description', { length: 500 }),
    description: text('description').notNull(),
    basePriceMinor: bigint('base_price_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    moderationStatus: productModerationStatusEnum('moderation_status').default('DRAFT').notNull(),
    rejectionReason: text('rejection_reason'),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    isActive: boolean('is_active').default(true).notNull(),
    isFragile: boolean('is_fragile').default(false).notNull(),
    isCustomizable: boolean('is_customizable').default(false).notNull(),
    customizationInstructions: text('customization_instructions'),
    productionLeadTimeDays: integer('production_lead_time_days').default(0).notNull(),
    materials: text('materials').array(),
    techniques: text('techniques').array(),
    careInstructions: text('care_instructions'),
    countryOfOrigin: varchar('country_of_origin', { length: 2 }).default('IN').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_products_seller').on(table.sellerId),
    index('idx_products_category').on(table.categoryId),
    index('idx_products_status').on(table.moderationStatus),
    index('idx_products_type').on(table.productType),
    index('idx_products_seller_status').on(table.sellerId, table.moderationStatus),
    index('idx_products_public_listing').on(table.moderationStatus, table.isActive),
    check('chk_products_base_price', sql`${table.basePriceMinor} >= 0`),
    check('chk_products_lead_time', sql`${table.productionLeadTimeDays} >= 0`),
  ],
);

// 3. Product Variants
export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 100 }).notNull().unique(),
    title: varchar('title', { length: 150 }).notNull(),
    priceMinor: bigint('price_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).default('INR').notNull(),
    compareAtPriceMinor: bigint('compare_at_price_minor', { mode: 'number' }),
    weightGrams: integer('weight_grams').notNull(),
    dimensionLengthMm: integer('dimension_length_mm').notNull(),
    dimensionWidthMm: integer('dimension_width_mm').notNull(),
    dimensionHeightMm: integer('dimension_height_mm').notNull(),
    attributes: jsonb('attributes').default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_variants_product').on(table.productId),
    index('idx_variants_sku').on(table.sku),
    check('chk_variants_price', sql`${table.priceMinor} >= 0`),
    check('chk_variants_weight', sql`${table.weightGrams} > 0`),
    check(
      'chk_variants_dimensions',
      sql`${table.dimensionLengthMm} > 0 AND ${table.dimensionWidthMm} > 0 AND ${table.dimensionHeightMm} > 0`,
    ),
  ],
);

// 4. Product Media
export const productMedia = pgTable(
  'product_media',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, {
      onDelete: 'set null',
    }),
    mediaType: mediaTypeEnum('media_type').default('IMAGE').notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
    altText: varchar('alt_text', { length: 255 }),
    displayOrder: integer('display_order').default(0).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_media_product').on(table.productId),
    index('idx_media_variant').on(table.variantId),
  ],
);

// 5. Moderation Records
export const moderationRecords = pgTable(
  'moderation_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    moderatorId: uuid('moderator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: varchar('action', { length: 50 }).notNull(), // APPROVED, REJECTED, SUSPENDED
    reasonCode: varchar('reason_code', { length: 100 }).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_moderation_product').on(table.productId),
    index('idx_moderation_moderator').on(table.moderatorId),
  ],
);

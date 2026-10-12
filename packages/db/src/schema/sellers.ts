import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  smallint,
  numeric,
  jsonb,
  index,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity.js';

// Enums
export const sellerBusinessTypeEnum = pgEnum('seller_business_type', [
  'INDIVIDUAL',
  'SOLE_PROPRIETORSHIP',
  'REGISTERED_COMPANY',
]);

export const sellerVerificationStatusEnum = pgEnum('seller_verification_status', [
  'DRAFT',
  'PENDING_REVIEW',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
]);

export const sellerDocumentTypeEnum = pgEnum('seller_document_type', [
  'GOVERNMENT_ID',
  'TAX_CERTIFICATE',
  'BANK_PROOF',
  'ARTISAN_CERTIFICATE',
]);

export const documentVerificationStatusEnum = pgEnum('document_verification_status', [
  'PENDING',
  'VERIFIED',
  'REJECTED',
]);

// 1. Seller Profiles
export const sellerProfiles = pgTable(
  'seller_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'restrict' }),
    businessType: sellerBusinessTypeEnum('business_type').notNull(),
    legalName: varchar('legal_name', { length: 255 }).notNull(),
    taxId: varchar('tax_id', { length: 100 }),
    verificationStatus: sellerVerificationStatusEnum('verification_status')
      .default('DRAFT')
      .notNull(),
    complianceTier: smallint('compliance_tier').default(1).notNull(),
    isPayoutEnabled: boolean('is_payout_enabled').default(false).notNull(),
    commissionRateBps: integer('commission_rate_bps').default(1000).notNull(), // 10.00%
    rejectionReason: text('rejection_reason'),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
    termsAcceptedVersion: varchar('terms_accepted_version', { length: 50 }),
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_seller_profiles_status').on(table.verificationStatus),
    index('idx_seller_profiles_user').on(table.userId),
    check(
      'chk_seller_commission_rate',
      sql`${table.commissionRateBps} >= 0 AND ${table.commissionRateBps} <= 10000`,
    ),
    check(
      'chk_seller_compliance_tier',
      sql`${table.complianceTier} >= 1 AND ${table.complianceTier} <= 3`,
    ),
  ],
);

// 2. Shops
export const shops = pgTable(
  'shops',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .unique()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    logoUrl: varchar('logo_url', { length: 500 }),
    bannerUrl: varchar('banner_url', { length: 500 }),
    craftStory: text('craft_story'),
    policies: jsonb('policies'),
    isVacationMode: boolean('is_vacation_mode').default(false).notNull(),
    vacationMessage: text('vacation_message'),
    ratingAverage: numeric('rating_average', { precision: 3, scale: 2 }).default('0.00').notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_shops_seller').on(table.sellerId),
    index('idx_shops_slug').on(table.slug),
    check('chk_shops_slug_format', sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check(
      'chk_shops_rating_range',
      sql`${table.ratingAverage} >= 0.00 AND ${table.ratingAverage} <= 5.00`,
    ),
  ],
);

// 3. Seller Documents (KYC)
export const sellerDocuments = pgTable(
  'seller_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    documentType: sellerDocumentTypeEnum('document_type').notNull(),
    storagePath: varchar('storage_path', { length: 500 }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    status: documentVerificationStatusEnum('status').default('PENDING').notNull(),
    reviewNotes: text('review_notes'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_seller_docs_seller').on(table.sellerId),
    index('idx_seller_docs_status').on(table.status),
    check('chk_seller_docs_size_positive', sql`${table.fileSizeBytes} > 0`),
  ],
);

// 4. Pickup Addresses
export const pickupAddresses = pgTable(
  'pickup_addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    contactName: varchar('contact_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    addressLine1: varchar('address_line1', { length: 255 }).notNull(),
    addressLine2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 100 }).notNull(),
    state: varchar('state', { length: 100 }).notNull(),
    postalCode: varchar('postal_code', { length: 20 }).notNull(),
    country: varchar('country', { length: 2 }).default('IN').notNull(),
    isDefault: boolean('is_default').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('idx_pickup_addresses_seller').on(table.sellerId)],
);

// 5. Payout Accounts
export const payoutAccounts = pgTable(
  'payout_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).default('STRIPE_CONNECT').notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    beneficiaryName: varchar('beneficiary_name', { length: 255 }).notNull(),
    accountLast4: varchar('account_last4', { length: 4 }).notNull(),
    bankName: varchar('bank_name', { length: 100 }),
    routingNumber: varchar('routing_number', { length: 50 }),
    isVerified: boolean('is_verified').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_payout_accounts_seller').on(table.sellerId),
    index('idx_payout_accounts_provider_id').on(table.providerAccountId),
  ],
);

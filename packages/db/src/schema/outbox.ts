import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// Transactional Outbox Table for Reliable CloudEvents Dispatch
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventType: varchar('event_type', { length: 150 }).notNull(),
    aggregateType: varchar('aggregate_type', { length: 100 }).notNull(),
    aggregateId: varchar('aggregate_id', { length: 255 }).notNull(),
    payload: jsonb('payload').notNull(),
    headers: jsonb('headers'),
    published: boolean('published').default(false).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
    retryCount: integer('retry_count').default(0).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_outbox_unpublished').on(table.published, table.createdAt),
    index('idx_outbox_aggregate').on(table.aggregateType, table.aggregateId),
  ],
);

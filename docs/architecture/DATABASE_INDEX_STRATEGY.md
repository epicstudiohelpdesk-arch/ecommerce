# Database Index Strategy & Performance Engineering

**Document Version:** 1.0.0  
**Effective Date:** Gate G03 Baseline  
**Status:** Performance Architecture Specification

---

## 1. Indexing Philosophy

Indexes in the Handcrafted Marketplace database are curated based on high-frequency query patterns, relational joins, unique business constraints, and concurrency locking requirements.

Indiscriminate index creation is prohibited to prevent write amplification, bloated index caches, and degraded write throughput on high-velocity tables (`ledger_entries`, `outbox_events`, `order_items`).

---

## 2. High-Impact Index Directory

### 2.1 Concurrency & Reservation Strategy

```sql
-- Fast lookup of inventory records by variant ID during checkout locking
CREATE INDEX "idx_inventory_variant" ON "inventory_items" USING btree ("variant_id");

-- Efficient polling of active reservations that have passed their 15-minute TTL
CREATE INDEX "idx_reservations_status_expires" ON "inventory_reservations" USING btree ("status", "expires_at");

-- Checkout session lookup for shopping cart reservation association
CREATE INDEX "idx_reservations_checkout" ON "inventory_reservations" USING btree ("checkout_id");
```

**Rationale:** The TTL sweeper regularly scans `WHERE status = 'ACTIVE' AND expires_at < NOW()`. The composite B-tree index on `(status, expires_at)` enables lightning-fast index range scans without evaluating expired rows across older completed orders.

### 2.2 Multi-Vendor Order & Fulfillment Routing

```sql
-- Join parent order to autonomous artisan sub-orders
CREATE INDEX "idx_sub_orders_parent" ON "sub_orders" USING btree ("parent_order_id");

-- Seller dashboard query: list all orders assigned to specific artisan
CREATE INDEX "idx_sub_orders_seller" ON "sub_orders" USING btree ("seller_id");

-- Enforces composite integrity constraint for order items
CREATE UNIQUE INDEX "idx_sub_orders_id_seller" ON "sub_orders" USING btree ("id", "seller_id");

-- Order item lookups by sub-order and variant
CREATE INDEX "idx_order_items_sub_order" ON "order_items" USING btree ("sub_order_id");
CREATE INDEX "idx_order_items_seller" ON "order_items" USING btree ("seller_id");
CREATE INDEX "idx_order_items_variant" ON "order_items" USING btree ("variant_id");
```

**Rationale:** Artisan dashboards and fulfillment updates filter directly by `seller_id`. Composite indexes allow instantaneous pagination of artisan sub-orders without full table scans on global orders.

### 2.3 Financial Ledger & Double-Entry Integrity

```sql
-- Query all entries belonging to a balanced journal batch
CREATE INDEX "idx_ledger_journal_batch" ON "ledger_entries" USING btree ("journal_batch_id");

-- Chart of accounts debit/credit aggregation
CREATE INDEX "idx_ledger_account" ON "ledger_entries" USING btree ("account_id");

-- Seller-specific financial ledger statement generation
CREATE INDEX "idx_ledger_seller" ON "ledger_entries" USING btree ("seller_id");

-- Sub-order financial history & audit
CREATE INDEX "idx_ledger_sub_order" ON "ledger_entries" USING btree ("sub_order_id");

-- Chronological audit statements
CREATE INDEX "idx_ledger_posted_at" ON "ledger_entries" USING btree ("posted_at");
```

**Rationale:** Calculating trial balances and generating seller settlement statements requires grouping entries by `journal_batch_id` and filtering by `seller_id` and `posted_at`.

### 2.4 Idempotency & Webhook Deduplication

```sql
-- External payment provider webhook deduplication
CREATE UNIQUE INDEX "idx_webhook_provider_event" ON "payment_webhook_events" USING btree ("provider", "event_id");

-- Unprocessed webhook event polling
CREATE INDEX "idx_webhook_processed" ON "payment_webhook_events" USING btree ("processed");

-- Client checkout idempotency deduplication
CREATE INDEX "idx_payment_attempts_idempotency" ON "payment_attempts" USING btree ("idempotency_key");
```

**Rationale:** External webhook retries (from Stripe/Razorpay) are guaranteed to be deduplicated at the storage engine level.

### 2.5 Transactional Outbox Worker Polling

```sql
-- Outbox dispatcher polling for unpublished events
CREATE INDEX "idx_outbox_unpublished" ON "outbox_events" USING btree ("published", "created_at");

-- Event aggregation tracing
CREATE INDEX "idx_outbox_aggregate" ON "outbox_events" USING btree ("aggregate_type", "aggregate_id");
```

**Rationale:** Background workers poll `WHERE published = false ORDER BY created_at ASC LIMIT 100`. The partial-like composite index makes worker polling near-instantaneous.

---

## 3. Write Amplification Mitigation & Monitoring

1. **Synthetic Surrogate Keys:** All B-tree indexes use 16-byte UUIDs rather than variable-length string tokens where possible.
2. **Sequential Append Friendly:** Tables with high insert volume (`audit_logs`, `ledger_entries`, `outbox_events`) index monotonic timestamps (`created_at`, `posted_at`).
3. **Index Fillfactor:** Default fillfactor (90%) is maintained. On high-update tables (`inventory_items`, `seller_balances`), updates operate on fixed-width numeric fields, maximizing PostgreSQL HOT (Heap-Only Tuple) optimization.

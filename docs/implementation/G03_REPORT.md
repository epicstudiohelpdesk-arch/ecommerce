# Gate G03: Production-Grade Database Architecture & Schema Implementation Report

**Project:** Handcrafted Multi-Vendor Marketplace  
**Gate:** G03 (Database Architecture & Schema Implementation)  
**Execution Timestamp:** 2026-10-12  
**Assessor:** Principal Database Architect, PostgreSQL Specialist & Security Engineer

---

## 1. Executive Summary

Gate G03 has been executed with strict architectural discipline, zero scope creep, and verifiable terminal evidence. The approved G02 domain models, multi-vendor order decomposition contracts, state machines, and financial rules have been translated into a production-grade relational database foundation in [`@repo/db`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db) powered by **PostgreSQL 16** and **Drizzle ORM**.

Key Milestones Achieved:

- **44 Strongly-Typed Relational Tables:** Complete schema across all 11 bounded domains (Identity, Sellers, Catalog, Inventory, Carts, Orders, Payments, Ledger, Shipping, Support, and Outbox).
- **Relational Multi-Tenant Seller Isolation:** Composite foreign keys (`sub_orders(id, seller_id)` -> `order_items(sub_order_id, seller_id)`) guarantee at the database engine level that order line items cannot be assigned to another seller's sub-order.
- **Atomic Inventory Reservations with 15-Minute TTL:** Row-level locking and atomic conditional updates prevent overselling unique handcrafted ($N=1$ OOAK) items during concurrent checkouts.
- **Double-Entry Financial Ledger Invariants:** Append-only postings requiring balanced debits and credits ($\sum \text{Debits} == \sum \text{Credits}$) within single atomic transactions.
- **Deterministic Development Seed Fixtures:** Repeatable multi-seller test fixtures (`packages/db/src/seed.ts`) isolated completely from production.
- **Authoritative SQL Migration Sequence:** Version-controlled SQL migration (`0000_fuzzy_mimic.sql`) reproducible from a clean database.
- **Automated Verification:** 15 database integration tests passing across 4 suites, monorepo linters passing, strict TypeScript type checking passing, and monorepo build passing with zero errors.

Gate G03 is **PASSED**. Per mandatory governance, all work is paused pending explicit human sign-off before Gate G04.

---

## 2. G00–G02 Prerequisite Verification

| Prerequisite Gate                             | Status     | Human Approval | Evidence Location                                                                                                             |
| :-------------------------------------------- | :--------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **G00 (Architecture Governance & Discovery)** | **PASSED** | Confirmed      | [`docs/implementation/G00_REPORT.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/implementation/G00_REPORT.md) |
| **G01 (Repository Foundation & Toolchain)**   | **PASSED** | Confirmed      | [`docs/implementation/G01_REPORT.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/implementation/G01_REPORT.md) |
| **G02 (Domain Architecture & API Contracts)** | **PASSED** | Confirmed      | [`docs/implementation/G02_REPORT.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/implementation/G02_REPORT.md) |

Git working tree was clean (`branch main`, commit `a99cacc`) prior to G03 commencement. Local database runtime was verified: PostgreSQL 16.15 running on port 5432.

---

## 3. Entity & Relationship Inventory

All 44 tables across 11 bounded contexts were implemented in [`packages/db/src/schema/`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/):

1. **Identity & Access (`identity.ts`):** `users`, `user_sessions`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`
2. **Seller & Shop (`sellers.ts`):** `seller_profiles`, `shops`, `seller_documents`, `pickup_addresses`, `payout_accounts`
3. **Catalog & Media (`catalog.ts`):** `categories`, `products`, `product_variants`, `product_media`, `moderation_records`
4. **Inventory & Reservations (`inventory.ts`):** `inventory_items`, `inventory_reservations`, `stock_adjustments`
5. **Shopping & Pricing (`carts.ts`):** `carts`, `cart_items`, `coupons`, `pricing_snapshots`
6. **Orders & Fulfillment (`orders.ts`):** `customer_orders`, `sub_orders`, `order_items`, `order_timeline_events`
7. **Payments (`payments.ts`):** `payment_attempts`, `payment_allocations`, `payment_webhook_events`, `refund_requests`
8. **Financial Ledger (`ledger.ts`):** `ledger_accounts`, `ledger_entries`, `seller_balances`, `payout_batches`, `payout_transactions`
9. **Shipping & Logistics (`shipping.ts`):** `shipments`, `shipment_milestones`, `return_requests`
10. **Reviews, Support & Disputes (`support.ts`):** `reviews`, `support_tickets`, `disputes`
11. **Event Outbox (`outbox.ts`):** `outbox_events`

---

## 4. Migration Files Created

The authoritative version-controlled migration was generated using Drizzle Kit and tested against an isolated database:

- **Migration File:** [`packages/db/migrations/0000_fuzzy_mimic.sql`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/migrations/0000_fuzzy_mimic.sql)
- **Snapshot Metadata:** [`packages/db/migrations/meta/0000_snapshot.json`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/migrations/meta/0000_snapshot.json)
- **Journal:** [`packages/db/migrations/meta/_journal.json`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/migrations/meta/_journal.json)

---

## 5. Constraints & Index Decisions

### 5.1 Business Check Constraints

- `chk_users_email_format`: Enforces regex email structure (`^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`).
- `chk_seller_commission_rate`: Limits basis points between 0 and 10,000 (0.00% to 100.00%).
- `chk_shops_slug_format`: Restricts slugs to lowercase alphanumeric hyphenated words (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- `chk_shops_rating_range`: Ensures ratings fall strictly within `0.00` to `5.00`.
- `chk_inventory_reserved_le_on_hand`: Protects `quantity_reserved <= quantity_on_hand` at the database level.
- `chk_order_items_total_price`: Validates arithmetic calculation `total_price_minor = unit_price_minor * quantity`.
- `chk_balances_available_payout`: Forbids negative seller balances.
- `chk_reviews_rating_range`: Enforces integer stars between 1 and 5.

### 5.2 Unique & Idempotency Constraints

- `uq_sub_orders_id_seller`: Enforces composite unique identity `(id, seller_id)` on `sub_orders`.
- `idx_webhook_provider_event`: Enforces `UNIQUE(provider, event_id)` on `payment_webhook_events` to prevent duplicate webhook processing.
- `payment_attempts.provider_intent_id` and `idempotency_key`: Strictly unique.
- `reviews.order_item_id`: Unique constraint enforcing verified purchase and preventing duplicate reviews per purchased item.

---

## 6. Inventory Concurrency Strategy & Test Evidence

### Strategy

Reservations implement atomic row-level conditional updates:

```sql
UPDATE inventory_items
SET quantity_reserved = quantity_reserved + :qty,
    updated_at = NOW()
WHERE variant_id = :id
  AND (quantity_on_hand - quantity_reserved) >= :qty
RETURNING id;
```

If updated row count is 0, the transaction returns `INSUFFICIENT_STOCK` immediately. When successful, an active reservation record is written with `expires_at = NOW() + INTERVAL '15 minutes'`. A periodic background sweeper marks expired reservations and returns stock to the available pool.

### Terminal Test Evidence (`packages/db/test/inventory.test.ts`)

```
✓ Inventory Concurrency & Atomic Reservation Safeguards > prevents overselling of One-of-a-Kind (N=1) item during concurrent checkout attempts (36ms)
✓ Inventory Concurrency & Atomic Reservation Safeguards > rejects illegal stock updates violating check constraint chk_inventory_reserved_le_on_hand (2ms)
✓ Inventory Concurrency & Atomic Reservation Safeguards > safely expires reservations and releases held inventory back to available pool (12ms)
```

---

## 7. Financial Integrity Strategy & Test Evidence

### Strategy

Double-entry bookkeeping is enforced through an atomic posting protocol. Every posted journal batch requires balanced debits and credits by currency ($\sum \text{Debits} == \sum \text{Credits}$). If a batch is unbalanced, the transaction immediately throws an error and aborts without persisting any partial entries.

### Terminal Test Evidence (`packages/db/test/ledger.test.ts`)

```
✓ Financial Integrity & Double-Entry Ledger Invariants > successfully posts a balanced double-entry customer order capture journal batch (53ms)
✓ Financial Integrity & Double-Entry Ledger Invariants > strictly rejects posting an unbalanced journal batch and rolls back (1ms)
✓ Financial Integrity & Double-Entry Ledger Invariants > rejects duplicate payment intents and duplicate idempotency keys (3ms)
✓ Financial Integrity & Double-Entry Ledger Invariants > enforces non-negative seller balance invariants (2ms)
```

---

## 8. Seller Isolation & Security Assessment

### Strategy

In a multi-vendor marketplace, cross-seller data tampering represents a critical vulnerability. In addition to application-level query scoping, database-level isolation is enforced via the composite foreign key:

```sql
ALTER TABLE "order_items"
  ADD CONSTRAINT "fk_order_items_sub_order_seller"
  FOREIGN KEY ("sub_order_id", "seller_id")
  REFERENCES "sub_orders" ("id", "seller_id")
  ON DELETE CASCADE;
```

### Terminal Test Evidence (`packages/db/test/seller-isolation.test.ts`)

```
✓ Seller Multi-Tenant Isolation & Relational Safeguards > strictly rejects attaching an order item to a sub-order belonging to a different seller (47ms)
✓ Seller Multi-Tenant Isolation & Relational Safeguards > enforces verified purchase on customer reviews and rejects duplicates (2ms)
```

---

## 9. Migration Reproducibility & Schema Evidence

The complete migration sequence was validated by dropping the test schema and running migrations cleanly:

```
[TEST-DB] Initializing test database from clean migrations...
[DB] Running migrations from: packages/db/migrations
[DB] Target database: postgresql://localhost:5432/marketplace_test
[DB] Migrations applied successfully.
[TEST-DB] Test database initialized and ready.
```

### Terminal Test Evidence (`packages/db/test/schema.test.ts`)

```
✓ Schema & Referential Integrity Tests > verifies that all expected tables exist in the migrated database (44 tables verified) (43ms)
✓ Schema & Referential Integrity Tests > rejects invalid email formats via check constraint (1ms)
✓ Schema & Referential Integrity Tests > rejects duplicate user emails via unique constraint (1ms)
✓ Schema & Referential Integrity Tests > rejects negative product base price via check constraint (2ms)
✓ Schema & Referential Integrity Tests > rejects duplicate payment webhook events via composite unique constraint (1ms)
✓ Schema & Referential Integrity Tests > rejects foreign key violation when referencing a nonexistent category (1ms)
```

---

## 10. Complete Test, Lint, Type-Check and Build Outcomes

Executed via authoritative script [`./scripts/verify-repo.sh`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/scripts/verify-repo.sh):

```
==========================================
Running Handcrafted Marketplace Verification
==========================================
[1/6] Checking Node and pnpm versions...
v24.14.1
11.9.0

[2/6] Verifying pnpm frozen lockfile...
Already up to date

[3/6] Verifying code formatting...
All matched files use Prettier code style!

[4/6] Running linters across workspaces...
Tasks: 9 successful, 9 total (0 errors, 0 warnings)

[5/6] Running TypeScript type checks...
Tasks: 9 successful, 9 total (0 type errors)

[6/6] Running automated test suites...
@repo/shared: 6/6 tests passed
@repo/validation: 3/3 tests passed
@repo/api-contracts: 2/2 tests passed
@repo/db: 15/15 integration tests passed
@apps/api: 1/1 tests passed
Total Tests: 27/27 PASSED (100%)

[+] Building all monorepo workspaces...
Tasks: 9 successful, 9 total (Next.js storefront, seller-portal, admin-portal, NestJS api, packages)

[+] Validating OpenAPI contracts specification...
OpenAPI Specification is 100% Valid! (22 paths, 108 $ref resolved)

==========================================
All Monorepo Verification Checks Passed!
==========================================
```

---

## 11. Known Defects and Unresolved Decisions

- **No Active Defects:** All check constraints, unique constraints, foreign keys, and tests are passing.
- **Pending Provider Details (Documented in G02):** Split-settlement capabilities for external gateways (e.g., Stripe Connect Custom vs. Express vs. Razorpay Route) remain abstracted behind `payment_allocations` and internal ledger postings until gateway credentials are integrated in future gates (G08).

---

## 12. Artifacts & Files Summary

### Files Created:

- [`packages/db/package.json`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/package.json)
- [`packages/db/tsconfig.json`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/tsconfig.json)
- [`packages/db/drizzle.config.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/drizzle.config.ts)
- [`packages/db/vitest.config.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/vitest.config.ts)
- [`packages/db/src/client.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/client.ts)
- [`packages/db/src/migrate.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/migrate.ts)
- [`packages/db/src/seed.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/seed.ts)
- [`packages/db/src/index.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/index.ts)
- [`packages/db/src/schema/identity.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/identity.ts)
- [`packages/db/src/schema/sellers.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/sellers.ts)
- [`packages/db/src/schema/catalog.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/catalog.ts)
- [`packages/db/src/schema/inventory.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/inventory.ts)
- [`packages/db/src/schema/carts.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/carts.ts)
- [`packages/db/src/schema/orders.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/orders.ts)
- [`packages/db/src/schema/payments.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/payments.ts)
- [`packages/db/src/schema/ledger.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/ledger.ts)
- [`packages/db/src/schema/shipping.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/shipping.ts)
- [`packages/db/src/schema/support.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/support.ts)
- [`packages/db/src/schema/outbox.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/outbox.ts)
- [`packages/db/src/schema/relations.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/relations.ts)
- [`packages/db/src/schema/index.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/src/schema/index.ts)
- [`packages/db/migrations/0000_fuzzy_mimic.sql`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/migrations/0000_fuzzy_mimic.sql)
- [`packages/db/test/global-setup.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/test/global-setup.ts)
- [`packages/db/test/test-db.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/test/test-db.ts)
- [`packages/db/test/schema.test.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/test/schema.test.ts)
- [`packages/db/test/seller-isolation.test.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/test/seller-isolation.test.ts)
- [`packages/db/test/inventory.test.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/test/inventory.test.ts)
- [`packages/db/test/ledger.test.ts`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/test/ledger.test.ts)
- [`docs/architecture/DATABASE_SCHEMA.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DATABASE_SCHEMA.md)
- [`docs/architecture/DATA_OWNERSHIP.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DATA_OWNERSHIP.md)
- [`docs/architecture/DATABASE_INDEX_STRATEGY.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DATABASE_INDEX_STRATEGY.md)
- [`docs/architecture/DATABASE_SECURITY.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DATABASE_SECURITY.md)
- [`docs/architecture/MIGRATION_POLICY.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/MIGRATION_POLICY.md)
- [`docs/security/DATA_RETENTION.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/security/DATA_RETENTION.md)
- [`docs/implementation/G03_REPORT.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/implementation/G03_REPORT.md)

### Files Modified:

- [`apps/api/package.json`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/apps/api/package.json) (Added `@repo/db` workspace dependency)
- [`README.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/README.md) (Added `@repo/db` to packages list and updated gate status)
- [`docs/implementation/GATE_ROADMAP.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/implementation/GATE_ROADMAP.md) (Updated G03 status to PASSED and aligned G04)

---

## 13. Gate Result

**GATE G03 RESULT: PASS**

All acceptance criteria defined in Section 13 of the G03 specification have been met with verifiable evidence.

---

## 14. Proposed Next Gate

**Proposed Next Gate: G04 — Authentication, Access Control & Identity Management (RBAC/ABAC)**

Scope of G04 will cover:

- Secure authentication routes (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`).
- Password hashing with Argon2id.
- Dual-token session strategy (short-lived JWT access tokens + rotating refresh tokens in `user_sessions`).
- NestJS authentication guards & RBAC/ABAC role enforcement based on the 11-role matrix.
- MFA (TOTP) initiation and verification.

---

## 15. Mandatory Stop Condition Enforcement

**All execution is halted.**  
In accordance with Rule 2.1 and Section 15 of the G03 mandate:

- No authentication routes or controllers have been implemented.
- No seller registration workflows have been built.
- No payment gateways or courier providers have been connected.
- No changes have been pushed to any remote production environment.
- Standing by for human review and explicit approval before commencing Gate G04.

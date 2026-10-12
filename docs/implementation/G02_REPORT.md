# Gate G02: Domain Architecture, Business Rules & API Contract Specification Report

**Project:** Handcrafted Multi-Vendor Marketplace  
**Gate:** G02 (Domain Architecture & API Specification)  
**Execution Timestamp:** 2026-10-12  
**Assessor:** Principal Domain Architect & Release Engineer

---

## 1. Executive Summary

Gate G02 establishes the comprehensive domain architecture, business rules, and API specifications for the Handcrafted Multi-Vendor Marketplace prior to database schema implementation.

The marketplace domain models the full lifecycle of handcrafted physical goods, including:

- Independent artisan onboarding, document verification (KYC), and storefront management.
- Distinct handcrafted product typologies: Ready-to-Ship, Made-to-Order (with variable production lead times), One-of-a-Kind (strictly unique $N=1$ stock), Multi-Variant, Personalized, and Fragile/Oversized.
- Multi-seller checkout orchestration: a single customer order automatically decomposes into autonomous artisan sub-orders with independent shipping, fulfillment, and escrow lifecycles.
- Atomic stock reservations during checkout with a 15-minute Time-To-Live (TTL) to prevent overselling unique handcrafted goods.
- An append-only double-entry financial ledger recording escrow holds, platform commissions, sales taxes, and seller payouts.
- Explicit state machines governing seller accounts, product listings, orders, shipments, payment attempts, and refunds.
- Defense-in-depth security: an 11-role authorization matrix, object-level attribute-based access control (ABAC) enforcing strict seller data isolation, and a dual-approval protocol for high-risk operations.
- OpenAPI 3.1.0 contract specification comprising 22 primary endpoints, fully validated with zero dangling schema references.

No database migrations, schema definitions, or business endpoints were implemented in code during this gate. Gate G02 is **PASSED**.

---

## 2. G01 Prerequisite Verification

- **G01 Result:** Explicitly marked **PASS** on 2026-10-12 in [`docs/implementation/G01_REPORT.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/implementation/G01_REPORT.md).
- **Git Commit Baseline:** Commit `7187e9d` on branch `main` confirmed clean.
- **Repository Health:** All monorepo verification checks (`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) confirmed green prior to starting G02.

---

## 3. Final Domain Boundaries

The platform is organized into eleven bounded contexts documented in [`docs/architecture/DOMAIN_BOUNDARIES.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DOMAIN_BOUNDARIES.md):

1. **Identity & Access Management (IAM):** User identities, authentication (Argon2id), sessions, and roles.
2. **Seller & Shop Management:** Artisan onboarding, legal verification (KYC), storefront profiles, and pickup coordinates.
3. **Catalog & Moderation:** Taxonomy categories, listings, variants, media attachments, and moderation review queues.
4. **Inventory & Production:** Stock balances, atomic reservations with 15-minute TTL, and made-to-order capacity.
5. **Cart & Pricing:** Multi-vendor cart grouping, tax estimation, shipping quotes, and immutable pricing snapshots.
6. **Orders & Sub-Orders:** Parent customer orders, artisan sub-orders, and order timeline events.
7. **Payments & Financial Ledger:** Gateway integrations, webhook idempotency, and double-entry ledger journals.
8. **Shipping & Logistics:** Multi-carrier gateway adapter, waybill generation, tracking milestones, and return parcels.
9. **Reviews & Customer Support:** Verified-buyer ratings, helpdesk tickets, and dispute mediation.
10. **Administration & Audit:** Staff governance, dual-approval controls, and immutable audit logs.
11. **Notification & Asynchronous Processing:** Transactional outbox relay and background job queues.

---

## 4. Core Entity & Relationship Summary

Codified in [`docs/architecture/DOMAIN_MODEL.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DOMAIN_MODEL.md):

- **Multi-Vendor Relational Mapping:**
  - `CustomerOrder` (1) $\rightarrow$ `SubOrder` ($N$): One parent order splits into $N$ seller fulfillment orders.
  - `SubOrder` (1) $\rightarrow$ `OrderItem` ($N$): Items belong strictly to one artisan sub-order.
  - `SubOrder` (1) $\rightarrow$ `Shipment` (1..$N$): Autonomous waybills, tracking numbers, and parcel dispatches.
  - `CustomerOrder` (1) $\rightarrow$ `PaymentAttempt` (1): Unified payment capture allocated across sub-orders.
  - `SubOrder` (1) $\rightarrow$ `LedgerEntry` ($N$): Double-entry entries balancing debits and credits for seller escrow and marketplace commission.
- **Handcrafted Product Distinctions:**
  - `READY_TO_SHIP`: Integer inventory balance $\ge 1$; fixed handling time.
  - `ONE_OF_A_KIND`: Strictly unique ($N=1$); auto-archives upon payment capture to prevent duplicate sales.
  - `MADE_TO_ORDER`: Dynamic production lead times (e.g., 7–21 days); cancellation restricted once production commences.
  - `PERSONALIZED`: Bespoke customer text/image inputs required and validated; non-returnable unless defective.
  - `FRAGILE_OVERSIZED`: Courier selection restricted to heavy/fragile certified parcel tiers; enhanced packaging buffers.

---

## 5. Endpoint Catalogue Summary

Codified in [`docs/api/ENDPOINT_CATALOG.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/api/ENDPOINT_CATALOG.md):

- **Authentication & Identity:**
  - `POST /api/v1/auth/register` (Customer registration)
  - `POST /api/v1/auth/login` (Credential login with secure cookie)
  - `POST /api/v1/auth/logout` (Session revocation)
- **Seller Onboarding:**
  - `POST /api/v1/seller/onboarding/apply` (Submit artisan KYC application)
  - `POST /api/v1/seller/onboarding/documents` (Private document upload pre-signed URL)
  - `GET /api/v1/seller/shop` (Seller profile & status)
- **Catalog & Listings:**
  - `GET /api/v1/catalog/products` (Public search with faceted filters)
  - `GET /api/v1/catalog/products/:slug` (Public listing details)
  - `POST /api/v1/seller/products` (Create product draft)
  - `POST /api/v1/seller/products/:productId/submit-review` (Submit listing for moderation)
- **Cart & Checkout:**
  - `GET /api/v1/cart` (Retrieve cart partitioned by seller)
  - `POST /api/v1/cart/items` (Add variant with customization prompt)
  - `POST /api/v1/checkout/session` (Atomic reservation & pricing snapshot)
- **Orders & Fulfillment:**
  - `GET /api/v1/orders` (Customer order history)
  - `GET /api/v1/seller/orders` (Seller sub-orders)
  - `POST /api/v1/seller/orders/:subOrderId/transition` (Advance fulfillment state)
- **Payments & Finance:**
  - `POST /api/v1/payments/webhooks/:provider` (Signed webhook processing with idempotency)
  - `GET /api/v1/seller/finance/balance` (Seller cleared & escrow statement)
- **Shipping & Logistics:**
  - `POST /api/v1/seller/orders/:subOrderId/shipment/book` (Book courier & generate waybill)
  - `POST /api/v1/shipping/webhooks/:carrier` (Courier tracking milestone push)
- **Administration & Governance:**
  - `POST /api/v1/admin/sellers/:sellerId/review` (Approve/reject artisan KYC)
  - `POST /api/v1/admin/catalog/products/:productId/moderate` (Moderate listing)
  - `POST /api/v1/admin/finance/refunds/:subOrderId/execute` (High-value refund with dual-approval)

---

## 6. OpenAPI Validation Results

- **File Path:** [`docs/api/OPENAPI.yaml`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/api/OPENAPI.yaml)
- **Validator Script:** [`scripts/validate-openapi.mjs`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/scripts/validate-openapi.mjs)
- **Execution Outcome:**
  - OpenAPI Version: `3.1.0`
  - Total Defined Endpoints: 22 paths
  - Scanned `$ref` References: 108
  - Dangling / Unresolved `$ref` References: **0**
  - Schema Resolution Status: **100% Valid**

---

## 7. State-Machine & Workflow Summary

Codified in [`docs/architecture/STATE_MACHINES.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/STATE_MACHINES.md):

1. **Seller Account Lifecycle:** `DRAFT` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `APPROVED` / `REJECTED` $\rightarrow$ `ACTIVE` $\rightarrow$ `RESTRICTED` $\rightarrow$ `SUSPENDED` $\rightarrow$ `CLOSED`.
2. **Product Listing Lifecycle:** `DRAFT` $\rightarrow$ `PENDING_REVIEW` $\rightarrow$ `APPROVED` / `REJECTED` $\rightarrow$ `PUBLISHED` $\rightarrow$ `UNPUBLISHED` $\rightarrow$ `SUSPENDED` $\rightarrow$ `ARCHIVED`.
3. **Parent Customer Order:** `PENDING_PAYMENT` $\rightarrow$ `PAID` $\rightarrow$ `PROCESSING` $\rightarrow$ `PARTIALLY_SHIPPED` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED` $\rightarrow$ `COMPLETED` / `CANCELLED` / `REFUNDED`.
4. **Seller Sub-Order:** `CONFIRMED` $\rightarrow$ `IN_PRODUCTION` $\rightarrow$ `READY_FOR_PICKUP` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED` $\rightarrow$ `COMPLETED` (after 7-day return escrow) / `CANCELLED` / `RETURN_REQUESTED` $\rightarrow$ `RETURNED`.
5. **Shipment Lifecycle:** `LABEL_CREATED` $\rightarrow$ `PICKUP_SCHEDULED` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED` / `DELIVERY_FAILED` $\rightarrow$ `RTO_INITIATED` $\rightarrow$ `RTO_DELIVERED`.
6. **Payment Attempt:** `INITIATED` $\rightarrow$ `PROCESSING` $\rightarrow$ `SUCCEEDED` / `FAILED` / `EXPIRED`.

---

## 8. Security & Authorization Findings

Codified in [`docs/security/AUTHORIZATION_MATRIX.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/security/AUTHORIZATION_MATRIX.md):

- **11-Role RBAC Model:** Defined permissions for `ANON`, `CUST`, `SELLER_APP`, `SELLER_PEND`, `SELLER_SUSP`, `SUPPORT`, `MANAGER`, `FINANCE`, `SAFETY`, `ANALYST`, and `SUPER_ADMIN`.
- **ABAC Tenant Isolation:** Sellers can only access resources matching their `seller_id`; cross-seller access returns 404/403 and triggers an immediate security alert.
- **Private KYC Document Protection:** Sensitive documents are stored in private S3 buckets with zero public access; only authorized compliance officers can generate temporary 5-minute pre-signed URLs.
- **Dual-Approval Governance:** High-risk actions (manual payouts $> \$1,000$, permanent seller bans, ledger adjustments) require two independent staff authorizations.
- **Direct Balance Mutation Forbidden:** All financial balances are strictly projected from double-entry ledger entries.

---

## 9. Event & Idempotency Design

Codified in [`docs/architecture/EVENT_CATALOG.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/EVENT_CATALOG.md):

- **CloudEvents Envelope:** Standardized JSON structure with `eventId`, `eventType`, `aggregateId`, `correlationId`, `timestamp`, and `payload`.
- **Transactional Outbox:** Events are written to the `outbox_events` table inside the primary database transaction to prevent data loss.
- **Idempotency Standards:**
  - Mutation endpoints require an `Idempotency-Key` UUID header.
  - Payment webhooks use `gateway:event:${providerEventId}` keys.
  - Event consumers record processed IDs in `idempotent_event_receipts`.

---

## 10. Unresolved Decisions & External Blockers

1. **Payment Gateway Marketplace Product:** Dependent on whether Stripe Connect (Custom vs. Express) or Razorpay Route is chosen for regional seller payout disbursement. The domain interface uses an abstract `PaymentProviderPort` to remain provider-agnostic until Gate G08.
2. **Sales Tax Nexus & GST Calculation:** Exact marketplace facilitator tax withholding rates depend on legal jurisdiction registration. Modeled via configurable tax rate tables.
3. **Courier Regional API Availability:** Final selection between Delhivery, Shiprocket, and BlueDart will be finalized in Gate G11. The domain interface uses a normalized `IShippingProvider` adapter.

---

## 11. Files Created or Modified

### Documentation Created:

- [`docs/architecture/DOMAIN_MODEL.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DOMAIN_MODEL.md): Canonical domain dictionary, handcrafted typology, and multi-vendor relationships.
- [`docs/architecture/DOMAIN_BOUNDARIES.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DOMAIN_BOUNDARIES.md): Bounded context map, service contracts, and anti-corruption layers.
- [`docs/architecture/STATE_MACHINES.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/STATE_MACHINES.md): Transition rules, guards, actors, and side effects.
- [`docs/architecture/ARCHITECTURE_DECISIONS.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/ARCHITECTURE_DECISIONS.md): Domain ADRs (ADR-015 through ADR-020).
- [`docs/architecture/EVENT_CATALOG.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/EVENT_CATALOG.md): Standardized domain events and transactional outbox rules.
- [`docs/api/API_STANDARDS.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/api/API_STANDARDS.md): REST standards, minor currency representation, envelopes, and rate limits.
- [`docs/api/ERROR_CATALOG.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/api/ERROR_CATALOG.md): Canonical error codes and RFC 7807 problem details.
- [`docs/api/ENDPOINT_CATALOG.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/api/ENDPOINT_CATALOG.md): 22 endpoints documented with all 16 architectural dimensions.
- [`docs/api/OPENAPI.yaml`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/api/OPENAPI.yaml): Fully validated OpenAPI 3.1.0 specification.
- [`docs/security/AUTHORIZATION_MATRIX.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/security/AUTHORIZATION_MATRIX.md): 11-role security matrix, ABAC tenancy, and dual-approval protocol.
- [`docs/implementation/G02_REPORT.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/implementation/G02_REPORT.md): This authoritative report.

### Tooling & Verification Created / Modified:

- [`scripts/validate-openapi.mjs`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/scripts/validate-openapi.mjs): Automated script parsing and verifying OpenAPI schema integrity.
- [`scripts/verify-repo.sh`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/scripts/verify-repo.sh): Updated to execute OpenAPI validation in the local verification suite.
- [`package.json`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/package.json): Added `yaml` to root `devDependencies`.
- [`README.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/README.md): Updated gate status table.
- [`docs/implementation/GATE_ROADMAP.md`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/implementation/GATE_ROADMAP.md): Updated G02 status to PASSED.

---

## 12. Actual Validation Evidence

| Validation Task                   | Command Executed                    | Outcome                                           | Status              |
| --------------------------------- | ----------------------------------- | ------------------------------------------------- | ------------------- |
| OpenAPI Parser & Schema Ref Check | `node scripts/validate-openapi.mjs` | 22 paths, 108 `$ref`s verified, 0 errors          | **PASSED** (Exit 0) |
| Prettier Formatting Check         | `pnpm format:check`                 | All documentation and YAML files match code style | **PASSED** (Exit 0) |
| ESLint Static Analysis            | `pnpm lint`                         | 9 workspaces checked, 0 errors, 0 warnings        | **PASSED** (Exit 0) |
| TypeScript Strict Compilation     | `pnpm typecheck`                    | 8 workspaces checked, 0 type errors               | **PASSED** (Exit 0) |
| Automated Test Suites             | `pnpm test`                         | 4 test suites passed (12/12 unit tests passed)    | **PASSED** (Exit 0) |
| Production Builds                 | `pnpm build`                        | 8 build tasks succeeded                           | **PASSED** (Exit 0) |
| Full Local Verification Suite     | `./scripts/verify-repo.sh`          | All checks including OpenAPI validation passed    | **PASSED** (Exit 0) |

---

## 13. Gate Result

# **PASS**

**Justification:**
All objectives of Gate G02 have been completely met:

- Complete domain model, handmade product typologies, and multi-vendor commerce hierarchies established.
- 11 bounded contexts mapped with explicit boundaries and service interfaces.
- State machines defined with strict transition rules, guards, and side effects.
- 22 primary API endpoints specified with all 16 required dimensions.
- OpenAPI 3.1.0 document authored and validated with zero dangling references.
- 11-role security matrix, ABAC tenant isolation, and dual-approval governance codified.
- Transactional outbox event catalog and idempotency keys established.
- No database migrations, schema creation, or business endpoints implemented.

---

## 14. Proposed Next Gate: Gate G03

The next scheduled gate is **G03: Database Schema, Drizzle Models & Migration Engine**.

Per Section 14 of the execution instructions:

- **All implementation work has stopped.**
- Gate G03 will not begin until explicit human approval is received. Please review this report and provide authorization to proceed to G03.

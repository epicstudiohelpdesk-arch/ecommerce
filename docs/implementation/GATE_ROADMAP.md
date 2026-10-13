# Implementation Gate Roadmap (G00 to G17)

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Status:** Baseline Established (Gate G00)

---

## 1. Roadmap Overview & Execution Principles

This roadmap outlines the complete 18-gate engineering progression from initial discovery through production operations.
Every gate is an auditable milestone governed by the following rules:

1. **Sequential Progression:** No gate may begin until the preceding gate has passed its Definition of Done and received explicit human sign-off.
2. **Strict Scope Confinement:** No forward implementation of future gates is permitted.
3. **Evidence-Based Acceptance:** Gates pass only upon verifiable terminal and CI output.
4. **Hard Dependency Invariants:**
   - Database schema foundations (G02) must precede all domain logic.
   - Identity & RBAC (G03) must precede seller onboarding (G04) and administrative tools (G14).
   - Atomic inventory reservations (G06) must precede checkout and payment capture (G08).
   - Payment webhook idempotency (G08) and order state machines (G09) must precede financial ledger recording and seller payouts (G10).
   - Ledger balance reconciliation (G10) and audit trails (G14) must precede end-to-end financial release sign-off (G16/G17).

---

## 2. Gate Progression Matrix (G00 - G17)

```
[G00: Architecture Governance & Discovery]
                     │
                     ▼
[G01: Monorepo Architecture & Developer Tooling]
                     │
                     ▼
[G02: Domain Architecture & API Contract Specification]
                     │
                     ▼
[G03: Database Architecture & Schema Implementation]
                     │
                     ▼
[G04: Production-Grade Authentication, Session Security & Authorisation]
                     │
                     ▼
[G05: Seller Onboarding & Document Verification]
                     │
                     ▼
[G06: Product Catalog, Taxonomy & Media Management]
                     │
                     ▼
[G07: Inventory Management & Atomic Reservations]
                     │
                     ▼
[G08: Cart, Pricing Engine & Multi-Vendor Calculations]
                     │
                     ▼
[G09: Payment Gateway Integration & Webhook Idempotency]
                     │
                     ▼
[G10: Order Processing & Sub-Order Splitting]
                     │
                     ▼
[G11: Financial Ledger, Commissions & Seller Payouts]
                     │
                     ▼
[G12: Courier Logistics, Shipping & Tracking]
                     │
                     ▼
[G13: Customer Storefront (Responsive Next.js Web App)]
                     │
                     ▼
[G14: Seller Dashboard & Shop Operations Portal]
                     │
                     ▼
[G15: Marketplace Admin Console, Moderation & Audit]
                     │
                     ▼
[G16: Customer Support, Returns, Refunds & Disputes]
                     │
                     ▼
[G17: Production Readiness, Observability & Release Governance]
```

---

## 3. Gate Breakdown & Verification Requirements

### Gate G00: Engineering Constitution, Repository Discovery & Governance

- **Focus:** Discovery, safety audit, baseline architecture, decision registers, risk assessment, and roadmap.
- **Dependencies:** None.
- **Deliverables:**
  - `docs/architecture/PROJECT_CONSTITUTION.md`
  - `docs/architecture/BASELINE_ARCHITECTURE.md`
  - `docs/architecture/DECISION_REGISTER.md`
  - `docs/architecture/RISK_REGISTER.md`
  - `docs/implementation/GATE_ROADMAP.md`
  - `docs/implementation/G00_REPORT.md`
- **Exit Criteria:** Green verification of environment, zero destructive changes, human sign-off.

---

### Gate G01: Monorepo Bootstrap, Toolchain & Shared Type System

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G02).
- **Focus:** Initialize Git repository, configure pnpm workspace, Turborepo pipeline, TypeScript bases, ESLint, Prettier, shared packages (`@repo/ui`, `@repo/config`, `@repo/validation`, `@repo/api-contracts`, `@repo/shared`), and application scaffolding (`apps/api`, `apps/storefront`, `apps/seller-portal`, `apps/admin-portal`).
- **Dependencies:** G00 passed and approved.
- **Exit Criteria:** `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` execute cleanly across all packages via Turborepo caching with an authoritative frozen lockfile.
- **Verification Result:** Fully verified on 2026-10-12 via `./scripts/verify-repo.sh` (8/8 builds successful, 4/4 test suites passing, strict TypeScript type checking passed).

---

### Gate G02: Domain Architecture, Business Rules & API Contract Specification

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G03).
- **Focus:** Define complete domain models, handcrafted product typologies, multi-vendor order decomposition, 11 bounded contexts, explicit state machines, 11-role authorization matrix, and validated OpenAPI 3.1.0 specifications.
- **Dependencies:** G01 passed and approved.
- **Exit Criteria:** Validated OpenAPI document, documented state machines, zero dangling schema references, and approval before database implementation.
- **Verification Result:** Fully verified on 2026-10-12 via `node scripts/validate-openapi.mjs` (22 paths, 108 `$ref`s verified, 0 errors).

---

### Gate G03: Production-Grade Database Architecture & Schema Implementation

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G04).
- **Focus:** Translate approved G02 domain models into a production-grade relational database foundation in `@repo/db` using PostgreSQL 16+ and Drizzle ORM. Implement 44 schema tables across 11 bounded domains, composite foreign keys enforcing multi-tenant seller isolation, inventory concurrency controls, balanced double-entry ledger invariants, reproducible SQL migrations, and deterministic seed fixtures.
- **Dependencies:** G00, G01, and G02 passed and approved.
- **Deliverables:**
  - `packages/db` workspace package with schemas, client, migrator, and seed fixtures.
  - `packages/db/migrations/0000_fuzzy_mimic.sql` authoritative initial migration.
  - `docs/architecture/DATABASE_SCHEMA.md`
  - `docs/architecture/DATA_OWNERSHIP.md`
  - `docs/architecture/DATABASE_INDEX_STRATEGY.md`
  - `docs/architecture/DATABASE_SECURITY.md`
  - `docs/architecture/MIGRATION_POLICY.md`
  - `docs/security/DATA_RETENTION.md`
  - `docs/implementation/G03_REPORT.md`
- **Exit Criteria:** Reproducible migration from clean DB, 100% passing integration tests (schema, seller isolation, inventory concurrency, ledger double-entry balance), zero lint/type errors.
- **Verification Result:** Fully verified on 2026-10-12: 44 tables migrated, 15 database integration tests passing across 4 suites, monorepo verification script passing with zero errors.

---

### Gate G04: Production-Grade Authentication, Session Security & Authorisation

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G05).
- **Focus:** Identity registration, Argon2id password hashing, rotating refresh tokens with server-managed `user_sessions`, 15-minute access JWTs, single-use email verification, fingerprint-protected password resets with session revocation, TOTP MFA with backup recovery codes for staff, 11-role RBAC guards, strict multi-tenant ABAC resource ownership guards, CSRF mitigation, and immutable security audit logging (`audit_logs`).
- **Dependencies:** G00, G01, G02, and G03 passed and approved.
- **Deliverables:**
  - `apps/api/src/modules/auth/` (AuthService, PasswordService, TokenService, SessionService, MfaService, AuthController, AuthModule)
  - `apps/api/src/modules/audit/` (AuditService, AuditModule)
  - `apps/api/src/modules/database/` (DatabaseService, DatabaseModule)
  - `apps/api/src/common/guards/` (`JwtAuthGuard`, `RolesGuard`, `SellerActiveGuard`, `ResourceOwnerGuard`)
  - `apps/api/src/common/middleware/` (`CsrfProtectionMiddleware`)
  - `apps/api/src/common/filters/` (`AllExceptionsFilter`)
  - `packages/validation/src/auth.ts` (Zod schemas for registration, login, MFA, and recovery)
  - `packages/api-contracts/src/auth.ts` (Contracts for tokens, auth users, results)
  - `docs/security/AUTHENTICATION.md`
  - `docs/security/SESSION_MANAGEMENT.md`
  - `docs/security/ACCOUNT_RECOVERY.md`
  - `docs/security/SECURITY_LOGGING.md`
  - `docs/implementation/G04_REPORT.md`
- **Exit Criteria:** 100% passing automated test suite covering authentication, token rotation, session invalidation, MFA challenge exchange, role-based authorization, multi-tenant resource isolation, CSRF protection, and audit sanitization.
- **Verification Result:** Fully verified on 2026-10-12: 41 tests passing across 6 test suites in `apps/api`, 70 total tests monorepo-wide, valid OpenAPI contract specification with 32 paths.

---

### Gate G05: Seller Onboarding, Document Verification & Shop Management

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G06).
- **Focus:** Artisan application workflow, legal business info ingestion, secure private document storage integration for KYC records, seller approval state machine (`DRAFT` -> `PENDING_REVIEW` -> `VERIFIED` / `REJECTED` / `SUSPENDED`), role promotions (`SELLER_APPLICANT` -> `APPROVED_SELLER`), segregation-of-duties review workspace in `admin-portal`, onboarding wizard in `seller-portal`, and `SellerEligibilityService` contracts.
- **Dependencies:** G00 through G04 approved.
- **Deliverables:**
  - `packages/db/migrations/0001_sharp_riptide.sql` forward-only migration
  - `packages/validation/src/seller.ts` Zod validation schemas
  - `packages/api-contracts/src/seller.ts` API contracts and DTOs
  - `apps/api/src/modules/sellers/` (`SellerOnboardingService`, `SellerReviewService`, `SellerEligibilityService`, `SellerDocumentsStorageService`, `SellerOnboardingController`, `AdminSellerReviewController`, `SellersModule`)
  - `apps/seller-portal/src/app/onboarding/page.tsx` Artisan onboarding wizard
  - `apps/admin-portal/src/app/sellers/page.tsx` Administrative verification workspace
  - `docs/architecture/SELLER_ONBOARDING.md`
  - `docs/implementation/G05_REPORT.md`
- **Exit Criteria:** Multi-tenant document isolation, 100% passing automated test suite covering draft saving, slug availability, KYC document upload constraints, application submission, role promotion, self-review prevention, administrative review decisions, and suspension/reinstatement.
- **Verification Result:** Fully verified on 2026-10-12: 61 tests passing in `apps/api` (95 total tests monorepo-wide), 42 valid OpenAPI paths, clean Next.js production builds.
- **Exit Criteria:** Tests confirming artisan document upload security (zero public bucket access), state transition validations, and seller profile creation.

---

### Gate G06: Product Catalogue, Listing Management & Inventory

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G07).
- **Focus:** Multi-category handcrafted taxonomy, artisan draft listings, variant & packaging specifications (dimensions mm, dead weight g), integer minor-unit pricing, HMAC-signed public media upload tickets, segregation-of-duties compliance review (`DRAFT` -> `PENDING_REVIEW` -> `PUBLISHED` / `REJECTED` / `ARCHIVED` / `SUSPENDED`), atomic concurrency-safe inventory adjustments (`SELECT ... FOR UPDATE`), negative stock prevention, reservation hold protection, and public catalog read filtering.
- **Dependencies:** G00 through G05 passed and approved.
- **Deliverables:**
  - `packages/db/migrations/0002_young_squirrel_girl.sql` forward-only migration.
  - `packages/validation/src/catalog.ts` catalog, variant, stock, and moderation validation schemas.
  - `packages/api-contracts/src/catalog.ts` catalog, inventory, and moderation DTOs.
  - `apps/api/src/modules/catalog/` (`CategoriesService`, `ProductMediaService`, `InventoryService`, `ProductManagementService`, `PublicCatalogService`, `ProductModerationService`, `SellerProductsController`, `SellerInventoryController`, `PublicCatalogController`, `AdminProductModerationController`, `CatalogModule`).
  - `apps/seller-portal/src/app/products/page.tsx` Artisan products catalogue & quick stock adjustment.
  - `apps/seller-portal/src/app/products/new/page.tsx` Handcrafted product creator form.
  - `apps/admin-portal/src/app/moderation/page.tsx` Administrative listing moderation queue.
  - `docs/architecture/PRODUCT_CATALOG_AND_INVENTORY.md`.
  - `docs/implementation/G06_REPORT.md`.
- **Exit Criteria:** 100% passing automated test suite covering draft creation, seller eligibility guard, multi-tenant seller isolation, completeness checking, photo upload tickets, moderation transitions, segregation of duties (self-review prevention), public catalog redaction, concurrency-safe inventory adjustments, and negative stock rejection.
- **Verification Result:** Fully verified on 2026-10-12: 11/11 tests passing in `test/catalog.integration.spec.ts` (72 total tests passing in `apps/api`, 106 tests monorepo-wide), 54 valid OpenAPI paths, clean Next.js production builds.

---

### Gate G07: Customer Storefront, Product Discovery & Product Details

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G08).
- **Focus:** Responsive, accessible customer storefront in `apps/storefront` (Next.js 15, React 19). Editorial homepage hero, craft category navigation grid, catalog filtering by craft type (`READY_TO_SHIP`, `MADE_TO_ORDER`, `ONE_OF_A_KIND`, `CUSTOMISABLE`), multi-parameter sorting (`newest`, `price_asc`, `price_desc`, `title_asc`), keyword search with query refinement, comprehensive product detail page with multi-image gallery (`ProductGallery`), dynamic edition/variant selection (`VariantSelector`), workshop provenance specs (materials, techniques, care instructions, lead times, dimensions, weight), Schema.org JSON-LD structured data, SEO metadata, and explicit Gate G08 purchasing notices.
- **Dependencies:** G00 through G06 passed and approved.
- **Deliverables:**
  - `apps/storefront/src/app/layout.tsx` (Root layout with header, footer, metadata, category injection)
  - `apps/storefront/src/app/page.tsx` (Homepage editorial hero, category cards, newest creations feed)
  - `apps/storefront/src/app/categories/page.tsx` (Categories overview directory)
  - `apps/storefront/src/app/categories/[slug]/page.tsx` (Category listing with filters, sort, pagination)
  - `apps/storefront/src/app/search/page.tsx` (Search results page with query form and filters)
  - `apps/storefront/src/app/products/[slug]/page.tsx` (Product detail page with gallery, variant selector, specs, Schema.org)
  - `apps/storefront/src/app/not-found.tsx` (Dedicated 404 handler)
  - `apps/storefront/src/components/layout/` (`header.tsx`, `footer.tsx`)
  - `apps/storefront/src/components/ui/` (`product-card.tsx`, `breadcrumbs.tsx`, `empty-state.tsx`, `error-state.tsx`, `product-gallery.tsx`, `variant-selector.tsx`)
  - `apps/storefront/src/lib/api.ts` (Typed storefront API client & price formatting)
  - `apps/storefront/test/storefront.spec.ts` (16 automated storefront tests)
  - `docs/architecture/STOREFRONT_ARCHITECTURE.md`
  - `docs/implementation/G07_REPORT.md`
- **Exit Criteria:** 100% passing automated test suite covering currency formatting, URL resolution, query serialization, network resilience, availability status rules, and structured data generation; zero purchasing feature bleeding; clean production Next.js build.
- **Verification Result:** Fully verified on 2026-10-12: 16/16 tests passing in `apps/storefront/test/storefront.spec.ts` (130 total tests passing monorepo-wide across 6 suites), clean Next.js build for all routes, valid OpenAPI contract specification with 54 paths, 100% Prettier format compliance.

---

### Gate G08: Shopping Cart, Checkout & Order Creation Foundation

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G09).
- **Focus:** Shopping cart persistence (guest `sessionId` and customer `customerId`), quantity caps ($1 \le q \le 50$), deduplication and login merging, saved customer delivery address management with Indian 6-digit PIN code (`/^[1-9][0-9]{5}$/`) and 10-digit mobile number validation, server-authoritative integer minor units pricing engine (paise in INR), independent artisan shipping fee rules (₹50.00 flat per artisan, free for artisan subtotal $\ge$ ₹1,000.00), platform/seller coupon discount engine, atomic 15-minute inventory reservation hold using row-level locking (`SELECT ... FOR UPDATE`), transactional order creation splitting checkout into parent `customer_orders`, artisan `sub_orders`, immutable `order_items`, and `order_timeline_events`, strictly enforced order invariants (`paymentStatus: 'PENDING'`, `orderStatus: 'PLACED'`), idempotency protection, and storefront UI in `apps/storefront` (`/cart`, `/checkout`, `/checkout/success`, header badge, and PDP "Add to Cart" enablement).
- **Dependencies:** G00 through G07 passed and approved.
- **Deliverables:**
  - `packages/db/migrations/0003_customer_addresses.sql` forward-only migration.
  - `packages/validation/src/cart.ts` and `src/checkout.ts` validation schemas.
  - `packages/api-contracts/src/cart.ts` and `src/checkout.ts` DTOs and contracts.
  - `apps/api/src/modules/cart/` (`CartService`, `CartController`, `CartModule`).
  - `apps/api/src/modules/checkout/` (`AddressService`, `AddressController`, `PricingService`, `CheckoutService`, `CheckoutController`, `CheckoutModule`).
  - `apps/api/src/modules/catalog/inventory.service.ts` atomic reservation methods (`createReservations`, `releaseReservations`, `commitReservations`).
  - `apps/storefront/src/lib/cart-context.tsx` (`CartProvider`, `useCart`).
  - `apps/storefront/src/components/layout/header.tsx` live cart counter badge.
  - `apps/storefront/src/components/ui/variant-selector.tsx` active "Add to Cart" button.
  - `apps/storefront/src/app/cart/page.tsx` artisan-partitioned shopping cart.
  - `apps/storefront/src/app/checkout/page.tsx` delivery address entry & order review.
  - `apps/storefront/src/app/checkout/success/page.tsx` order confirmation view.
  - `docs/architecture/CART_AND_CHECKOUT_ARCHITECTURE.md`.
  - `docs/implementation/G08_REPORT.md`.
- **Exit Criteria:** 100% passing automated test suite covering multi-vendor cart grouping, 50-qty limits, login cart merging, delivery address PIN/phone validation, integer pricing calculations, atomic stock reservations, overselling prevention, order creation, artisan sub-order partitioning, and idempotency; zero premature payment capture or ledger disbursement; clean production Next.js build.
- **Verification Result:** Fully verified on 2026-10-12: 14/14 tests passing in `apps/api/test/cart-checkout.integration.spec.ts` (86 total tests passing in `apps/api`, 144 tests monorepo-wide across 6 suites), clean Next.js production builds for all 3 apps, valid OpenAPI specification with 54 paths, 100% Prettier format compliance.

---

### Gate G07A: Master UI/UX Design System, Design Governance & Experience Blueprint

- **Status:** **PASSED** (Ready for human review; stop condition enforced).
- **Focus:** Master UI/UX design system across all three frontend applications (`storefront`, `seller-portal`, `admin-portal`). Contemporary Indian Craftsmanship visual identity, semantic design tokens (`colors`, `typography`, `spacing`, `radii`, `elevation`, `breakpoints`, `motion`), shared Tailwind presets and PostCSS pipelines generating production CSS bundles, comprehensive `@repo/ui` component library (20 primitives covering foundations, layout, forms, overlays, tables, and feedback with complete lifecycle states), application shells (`SellerHeader`, `SellerFooter`, `AdminHeader`, `AdminFooter`), WCAG 2.2 AA accessibility compliance, responsive mobile-first rules, end-to-end user journeys, and screen specifications.
- **Dependencies:** G00 through G08 passed and approved.
- **Deliverables:**
  - `packages/ui/src/tokens/` (`colors.ts`, `typography.ts`, `spacing.ts`, `theme.css`, `index.ts`)
  - `packages/ui/src/tailwind-preset.ts`
  - `packages/ui/src/components/` (`Container`, `Divider`, `SectionHeader`, `Button`, `IconButton`, `Badge`, `Card`, `StatusIndicator`, `Skeleton`, `LoadingSpinner`, `EmptyState`, `ErrorState`, `Alert`, `FormField`, `Input`, `Textarea`, `Select`, `Checkbox`, `Modal`, `ConfirmDialog`, `Table`, `Pagination`, `Breadcrumb`)
  - `packages/ui/test/design-system.test.ts` (14 automated tests)
  - `apps/storefront/` Tailwind + PostCSS pipeline & CSS bundle
  - `apps/seller-portal/src/components/layout/` (`seller-header.tsx`, `seller-footer.tsx`) & CSS bundle
  - `apps/admin-portal/src/components/layout/` (`admin-header.tsx`, `admin-footer.tsx`) & CSS bundle
  - `docs/design/MASTER_DESIGN_SYSTEM.md`
  - `docs/implementation/G07A_REPORT.md`
- **Exit Criteria:** 100% passing automated test suites (144 tests monorepo-wide), 0 lint/typecheck errors, production Next.js CSS compilation across all 3 apps, comprehensive design system and journey blueprint documentation matching implementation, zero premature future-gate features.
- **Verification Result:** Fully verified on 2026-10-12 via `./scripts/verify-repo.sh` (144/144 tests passing, 9/9 builds successful, 100% Prettier formatting compliant, OpenAPI 3.1 valid).

---

### Gate G09: Payment Gateway, Marketplace Commissions & Financial Ledger

- **Status:** **PASSED** (Ready for human review; stop condition enforced before G10).
- **Focus:** Server-authoritative payment provider adapters (Razorpay for India-first INR paise, UPI, Cards, NetBanking; Stripe for international cards; MockPaymentProvider for testing), server-authoritative marketplace commission engine with exact financial conservation ($\text{netSellerPayable} + \text{commissionFee} + \text{tax} \equiv \text{itemSubtotal} + \text{shippingFee}$), append-only balanced double-entry financial ledger enforcing $\sum \text{Debits} == \sum \text{Credits}$ across all journal batches, cryptographic webhook ingestion with timing-safe HMAC verification and replay defense, state machine coordination from `PLACED` to `PAID` / `PROCESSING`, over-refund guarded returns with pro-rata commission reversals, automated reconciliation audit engine, and customer payment UI in `apps/storefront` (`/checkout/payment`, retry on failure, live status in `/checkout/success`).
- **Dependencies:** G00 through G08 (including G07A) passed and approved.
- **Deliverables:**
  - `packages/validation/src/payments.ts` (Zod schemas for payment initiation, verification, and refunds)
  - `packages/api-contracts/src/payments.ts` (DTOs for payments, refunds, balances, ledger, and reconciliation)
  - `apps/api/src/modules/payments/interfaces/payment-provider.interface.ts` (`IPaymentProvider` abstraction)
  - `apps/api/src/modules/payments/providers/` (`razorpay.provider.ts`, `stripe.provider.ts`, `mock.provider.ts`)
  - `apps/api/src/modules/payments/commission.service.ts` (authoritative commission calculations and pro-rata refund math)
  - `apps/api/src/modules/ledger/` (`ledger.service.ts`, `ledger.controller.ts`, `ledger.module.ts`)
  - `apps/api/src/modules/payments/` (`payments.service.ts`, `reconciliation.service.ts`, `payments.controller.ts`, `webhook.controller.ts`, `admin-finance.controller.ts`, `payments.module.ts`)
  - `apps/storefront/src/app/checkout/payment/page.tsx` & `/checkout/success/page.tsx` payment experience
  - `docs/api/OPENAPI.yaml` (61 paths, 279 references, 100% valid)
  - `docs/implementation/G09_REPORT.md`
- **Exit Criteria:** 100% passing automated test suite covering payment initiation, cryptographic webhook verification, idempotent capture, state coordination, double-entry ledger balance invariants, commission calculations, over-refund prevention, and reconciliation audit; zero simulated payment captures in production code; zero raw card data stored; clean production Next.js build.
- **Verification Result:** Fully verified on 2026-10-13 via `./scripts/verify-repo.sh` (180 tests passing monorepo-wide across 7 suites, 9/9 builds successful, 0 lint/type errors, 100% Prettier formatting compliant, OpenAPI 3.1 valid).

---

### Gate G11: Courier Logistics, Shipping & Tracking Integration

- **Focus:** Courier provider adapter, shipping label generation per artisan sub-order, tracking milestone webhook ingestion, automated order status synchronization.
- **Dependencies:** G09.
- **Exit Criteria:** Successful mock shipment dispatch, tracking webhook ingestion test, and delivery milestone confirmation.

---

### Gate G12: Customer Storefront (Responsive Next.js Web App)

- **Focus:** Modern, responsive e-commerce web application (`web-store`), artisan storytelling pages, product catalog browsing, faceted filtering, cart, and checkout flow.
- **Dependencies:** G08, G09.
- **Exit Criteria:** Next.js build succeeds; Lighthouse mobile performance, accessibility, and SEO scores meet production thresholds.

---

### Gate G13: Seller Dashboard & Storefront Operations Portal

- **Focus:** Seller web application (`web-portal`), artisan shop settings, product management, sub-order fulfillment, shipping label printing, earnings and payout analytics.
- **Dependencies:** G04, G09, G10.
- **Exit Criteria:** End-to-end seller fulfillment journey test; strict verification that seller cannot view another artisan's data.

---

### Gate G14: Marketplace Admin Console, Moderation & Audit Control

- **Focus:** SuperAdmin & Staff management portal, artisan KYC review and approval, product moderation queue, dispute mediation, platform financial oversight, immutable audit log explorer.
- **Dependencies:** G04, G05, G10.
- **Exit Criteria:** Complete admin review flow test; audit log verification proving every administrative action produces an unalterable log entry.

---

### Gate G15: Customer Support, Returns, Refunds & Dispute Management

- **Focus:** Return authorization requests, artisan dispute resolution, return shipping label dispatch, automated reverse ledger transactions, and customer refunds.
- **Dependencies:** G10, G11.
- **Exit Criteria:** Integration test for complete dispute and refund lifecycle verifying balanced ledger state post-refund.

---

### Gate G16: End-to-End System Integration, Security Hardening & Performance

- **Focus:** Cross-application Playwright testing, penetration testing (OWASP Top 10, IDOR, CSRF, SQLi), database query optimization, load testing on concurrent checkouts.
- **Dependencies:** G00 through G15.
- **Exit Criteria:** 100% passing E2E test suite, zero critical/high security vulnerabilities, stable latency under simulated peak load.

---

### Gate G17: Production Readiness, Observability, CI/CD & Release Governance

- **Focus:** Production deployment configuration, multi-stage Docker builds, Kubernetes/container manifests, OpenTelemetry distributed tracing, structured logging dashboards, disaster recovery drill, final human sign-off.
- **Dependencies:** G16.
- **Exit Criteria:** Production smoke tests pass, zero errors in observability logs, verified automated rollback procedure.

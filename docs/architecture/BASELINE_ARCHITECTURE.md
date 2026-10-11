# Baseline Architecture Specification

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Status:** Architectural Baseline (Gate G00)

---

## 1. System Topology Overview

The system is designed as a **TypeScript-first, Monorepo-structured Modular Monolith** optimized for developer velocity, strict domain boundaries, rapid deployments, and reliable financial consistency.

```
                              ┌─────────────────────────────────────────┐
                              │            Client Layer                 │
                              │  ┌──────────────────┐  ┌─────────────┐  │
                              │  │ Customer Store   │  │ Seller &    │  │
                              │  │ (Next.js WebApp) │  │ Admin Portal│  │
                              │  │                  │  │ (Next.js)   │  │
                              │  └─────────┬────────┘  └──────┬──────┘  │
                              └────────────┼──────────────────┼─────────┘
                                           │ HTTPS / REST     │ HTTPS / REST
                                           ▼                  ▼
                              ┌─────────────────────────────────────────┐
                              │    API Gateway / Monolith Host          │
                              │             (NestJS)                    │
                              │  - Rate Limiting (Throttler)            │
                              │  - Global Auth Guard (JWT/Cookies)      │
                              │  - Request Logging & Tracing            │
                              └────────────────────┬────────────────────┘
                                                   │
 ┌─────────────────────────────────────────────────┴─────────────────────────────────────────────────┐
 │                                   Modular Domain Services                                         │
 │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────────────┐ │
 │ │ Identity &    │ │ Customers &   │ │ Seller & Shop │ │ Catalog &     │ │ Inventory &          │ │
 │ │ Access (RBAC) │ │ Profiles      │ │ Verification  │ │ Taxonomy      │ │ Atomic Reservations  │ │
 │ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └──────────────────────┘ │
 │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────────────┐ │
 │ │ Cart &        │ │ Order & Sub-  │ │ Payments &    │ │ Financial     │ │ Logistics, Shipping  │ │
 │ │ Checkout      │ │ Order Split   │ │ Webhook Guard │ │ Ledger & Pay  │ │ & Tracking           │ │
 │ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └──────────────────────┘ │
 │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────────────┐ │
 │ │ Reviews &     │ │ Disputes &    │ │ Notification  │ │ Admin Audit   │ │ Transactional        │ │
 │ │ Moderation    │ │ Returns       │ │ Dispatcher    │ │ & Reporting   │ │ Outbox Publisher     │ │
 │ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └──────────────────────┘ │
 └─────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                   │
                     ┌─────────────────────────────┼─────────────────────────────┐
                     ▼                             ▼                             ▼
        ┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
        │  Relational Database    │   │ Cache & Queue Broker    │   │ Object Storage          │
        │  PostgreSQL 16+         │   │ Redis 7+ / 8+           │   │ S3-Compatible           │
        │  - Drizzle ORM Schema   │   │ - Session & Rate Limits │   │ - Public: Product Media │
        │  - Explicit Migrations  │   │ - BullMQ Job Queues     │   │ - Private: Seller Docs  │
        │  - Double-entry Ledger  │   │ - Outbox Relay Worker   │   │ - Pre-signed URLs       │
        └─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
```

---

## 2. Workspace & Monorepo Structure

The codebase is organized in a `pnpm` monorepo coordinated by `Turborepo`:

```
ecommerce/
├── apps/
│   ├── web-store/                 # Customer-facing responsive marketplace (Next.js)
│   ├── web-portal/                # Seller dashboard & Admin control center (Next.js)
│   └── api/                       # Modular Monolith REST API backend (NestJS)
├── packages/
│   ├── db/                        # Drizzle ORM schema, migrations, connection pools
│   ├── config/                    # Shared ESLint, Prettier, and TypeScript configurations
│   ├── contracts/                 # Shared Zod schemas, DTOs, and API contract types
│   ├── ui/                        # Shared design system components & Tailwind presets
│   └── utils/                     # Shared logging, currency, date, and math utilities
├── docs/                          # Architecture, decision records, reports, roadmaps
├── pnpm-workspace.yaml            # Monorepo workspace definition
├── turbo.json                     # Turborepo pipeline orchestration
├── package.json                   # Root workspace manifest
└── tsconfig.base.json             # Root TypeScript configuration
```

---

## 3. Technology Stack & Component Selection

| Layer                     | Chosen Technology                              | Version Baseline                   | Architectural Rationale                                                       |
| ------------------------- | ---------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| **Package Manager**       | `pnpm`                                         | 11.x / 10.x                        | Strict dependency isolation, symlink-based deduping, rapid installation.      |
| **Monorepo Engine**       | `Turborepo`                                    | 2.x                                | High-performance build caching, topological task scheduling.                  |
| **Language**              | `TypeScript`                                   | 5.x                                | Strict end-to-end type safety across backend, frontend, and shared contracts. |
| **Customer Storefront**   | `Next.js` (App Router)                         | 15.x                               | SSR/SSG for SEO on product/artisan pages, dynamic client components.          |
| **Portal (Seller/Admin)** | `Next.js` (App Router)                         | 15.x                               | Unified React component library, server actions, route protection.            |
| **Backend Framework**     | `NestJS`                                       | 11.x                               | Robust modular architecture, dependency injection, OpenAPI integration.       |
| **Database Engine**       | `PostgreSQL`                                   | 16+ (Homebrew psql 17.11 detected) | ACID transactions, row-level locking, rich JSONB & financial numeric types.   |
| **ORM / Migration**       | `Drizzle ORM`                                  | 0.38+                              | Zero-overhead, type-safe SQL-like queries, explicit reproducible migrations.  |
| **Cache & Queue**         | `Redis` + `BullMQ`                             | Redis 7+/8+                        | Background task orchestration, delayed outbox dispatch, distributed locks.    |
| **Object Storage**        | S3-Compatible (MinIO / AWS S3 / Cloudflare R2) | API v4                             | Multi-tier storage: public CDN for images, IAM-protected bucket for KYC docs. |
| **Validation**            | `Zod` & `class-validator`                      | Latest                             | Runtime schema validation, input sanitation, boundary verification.           |
| **Documentation**         | `OpenAPI` / Swagger                            | 3.1                                | Auto-generated interactive API documentation and client SDK generation.       |

---

## 4. Domain Modules & Boundary Rules

### 4.1 Boundary Invariants

1. **No Circular Dependencies:** Modules may depend downward on shared libraries (`@repo/db`, `@repo/contracts`) and invoke adjacent modules only through declared Service interfaces or published domain events.
2. **Encapsulated Data Access:** Modules interact with their own tables. Direct cross-domain SQL joins are prohibited outside dedicated read-model reporting queries.
3. **Multi-Vendor Sub-Orders:** A customer placing an order containing items from multiple artisans creates one parent `Order` and multiple seller-specific `SubOrder` records. Each seller only sees their assigned `SubOrder`.

### 4.2 Backend Module Breakdown

1. **Identity & Access Management (IAM):**
   - User authentication (Customer, Seller, Staff, Administrator).
   - Secure HTTP-only cookies and JWT rotation.
   - RBAC and ABAC guards.
2. **Customers & Addresses:**
   - Customer profile management, verified shipping and billing address book.
3. **Seller Onboarding & KYC:**
   - Artisan registration, tax ID / business registration upload, ID verification workflow.
   - Seller approval lifecycle (`PENDING`, `UNDER_REVIEW`, `VERIFIED`, `SUSPENDED`).
4. **Shops & Artisan Profiles:**
   - Shop profile, biography, craft story, studio location, policies, banner/avatar.
5. **Catalog & Taxonomy:**
   - Categories (Woodwork, Pottery, Painting, Jewelry, Textiles, Sculptures, Bespoke).
   - Multi-variant products, customizable attributes, moderation states (`PENDING`, `APPROVED`, `REJECTED`).
6. **Inventory & Reservation Engine:**
   - Stock tracking per SKU/variant.
   - Atomic reservation with TTL during checkout.
   - Safe stock decrement upon successful payment; automatic release upon expiration.
7. **Cart & Pricing Engine:**
   - Persistent customer cart, tier/volume pricing, promotional discounts, shipping calculation.
8. **Orders & Sub-Order Splitting:**
   - Parent order creation, atomic decomposition into artisan sub-orders.
   - Sub-order state machines: `PLACED` -> `CONFIRMED` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED` -> `COMPLETED`.
9. **Payments & Webhooks:**
   - Abstract payment provider adapter (e.g., Stripe / Razorpay).
   - Cryptographic webhook signature verification.
   - Strict idempotency key checking (`payment_events` table).
10. **Financial Ledger & Payouts:**
    - Double-entry ledger journal (`ledger_entries`).
    - Platform commission deduction, payment processing fee allocation.
    - Seller reserve holding period (anti-fraud / return window escrow).
    - Payout batch calculation and export/disbursement.
11. **Logistics & Courier Gateway:**
    - Courier provider abstraction (Shiprocket, Delhivery, EasyPost).
    - Waybill / shipping label generation.
    - Webhook-based shipment milestone tracking.
12. **Reviews & Moderation:**
    - Verified-purchaser review submission, ratings, seller public replies.
    - Automated and manual content moderation for inappropriate text/images.
13. **Customer Support, Returns & Disputes:**
    - Return requests, dispute mediation between buyer and artisan.
    - Reverse pickup logistics, refund triggers.
14. **Notification Engine:**
    - Template-based transactional emails (order confirmation, dispatch, payout receipt).
    - In-app notification center.
15. **Audit Trails & Admin Control:**
    - Immutable audit logs for all administrative actions (`actor_id`, `action`, `target`, `metadata`).
    - Marketplace-wide financial and operational reporting.

---

## 5. Security Architecture

1. **Private Seller Documents:** Stored in a dedicated private S3 bucket with zero public read permissions. Download access requires an authenticated backend endpoint that issues a pre-signed URL expiring in 5 minutes.
2. **CSRF & XSS Mitigation:** Secure HTTP-only, `SameSite=Lax` or `Strict` cookie flags, Content Security Policy (CSP), sanitized Markdown/HTML rendering.
3. **Rate Limiting:** IP-based and user-based sliding-window rate limiting in Redis on authentication, search, and checkout endpoints.
4. **Zero-Trust Cross-Seller Checks:** Every handler processing sub-orders, product updates, or financial data verifies:
   $$\text{SubOrder.seller\_id} == \text{CurrentSession.seller\_id}$$
   Violations trigger an immediate 403 Forbidden and security audit log alert.

---

## 6. Resilience & High-Availability Patterns

1. **Transactional Outbox:**
   - Domain mutations insert events into an `outbox` table in the same DB transaction.
   - A dedicated worker reads published events, dispatches them to Redis/BullMQ, and marks them dispatched.
2. **Graceful Degradation:**
   - If Redis is temporarily degraded, read caches fail open to PostgreSQL.
   - If a courier API is unreachable, shipment label generation is queued with exponential backoff.
3. **Safe Database Migrations:**
   - All migrations generated via Drizzle must be forward-compatible, reviewed, and non-destructive. Schema changes never drop active columns during rolling updates.

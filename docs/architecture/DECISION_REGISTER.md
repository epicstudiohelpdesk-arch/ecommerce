# Architecture Decision Register (ADR)

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Status:** Active Baseline (Gate G00)

---

## Index of Architecture Decisions

- [ADR-001: Monorepo Structure & Build Orchestration](#adr-001-monorepo-structure--build-orchestration)
- [ADR-002: Backend Architecture Pattern (Modular Monolith)](#adr-002-backend-architecture-pattern-modular-monolith)
- [ADR-003: Relational Database Engine (PostgreSQL 16+)](#adr-003-relational-database-engine-postgresql-16)
- [ADR-004: Data Access & Schema Migration Tool (Drizzle ORM)](#adr-004-data-access--schema-migration-tool-drizzle-orm)
- [ADR-005: Authentication & Session Strategy](#adr-005-authentication--session-strategy)
- [ADR-006: Multi-Tenant Seller Isolation Mechanism](#adr-006-multi-tenant-seller-isolation-mechanism)
- [ADR-007: Media & Private Document Storage Strategy](#adr-007-media--private-document-storage-strategy)
- [ADR-008: Asynchronous Job Processing & Event Distribution](#adr-008-asynchronous-job-processing--event-distribution)
- [ADR-009: Payment Processing & Double-Entry Financial Ledger](#adr-009-payment-processing--double-entry-financial-ledger)
- [ADR-010: Courier Logistics & Shipping Integration](#adr-010-courier-logistics--shipping-integration)
- [ADR-011: Frontend Applications & Shared Design System](#adr-011-frontend-applications--shared-design-system)
- [ADR-012: Comprehensive Testing & Verification Strategy](#adr-012-comprehensive-testing--verification-strategy)
- [ADR-013: Deployment, Infrastructure & Containerization](#adr-013-deployment-infrastructure--containerization)
- [ADR-014: Structured Logging, Tracing & Audit Trail](#adr-014-structured-logging-tracing--audit-trail)

---

### ADR-001: Monorepo Structure & Build Orchestration

- **Decision ID:** ADR-001
- **Topic:** Repository Structure & Build Orchestration
- **Current Proposed Decision:** Adopt a `pnpm` monorepo with `Turborepo` managing task orchestration, caching, and dependency graphs.
- **Rationale:** Monorepo architecture enables end-to-end TypeScript type sharing between backend contracts and frontend applications, unified dependency management via symlinks, and parallel cached CI pipelines.
- **Alternatives Considered:**
  - _Polyrepo (separate Git repos):_ High coordination overhead for contract updates, out-of-sync type definitions, duplicated tooling.
  - _Nx:_ Rich feature set, but higher configuration complexity than Turborepo for this scale.
  - _npm/yarn workspaces:_ Slower installs, less robust deduplication compared to pnpm.
- **Trade-offs:** Initial monorepo setup complexity; requires disciplined package boundaries.
- **Dependencies:** None.
- **Status:** Proposed (Ready for G01 adoption).
- **Finalisation Gate:** G01.

---

### ADR-002: Backend Architecture Pattern (Modular Monolith)

- **Decision ID:** ADR-002
- **Topic:** API Architecture & Service Topology
- **Current Proposed Decision:** Build a **Modular Monolith** using NestJS, organizing code into strict domain modules (Catalog, Inventory, Orders, Ledger, etc.) communicating via well-defined internal service interfaces.
- **Rationale:** Avoids distributed system complexity (network latency, partial failures, distributed 2PC transactions, eventual consistency headaches) while enforcing clean code boundaries that can be split into microservices later if scaling demands dictate.
- **Alternatives Considered:**
  - _Microservices:_ Premature operational burden, difficult transactional consistency across inventory and orders.
  - _Unstructured Monolith (Express spaghetti):_ Rapid erosion of boundaries, spaghetti dependencies, unmaintainable.
- **Trade-offs:** Requires strict architectural governance to prevent cross-module boundary violations.
- **Dependencies:** ADR-001.
- **Status:** Proposed.
- **Finalisation Gate:** G01.

---

### ADR-003: Relational Database Engine (PostgreSQL 16+)

- **Decision ID:** ADR-003
- **Topic:** Database Engine
- **Current Proposed Decision:** Standardize on **PostgreSQL 16+** (PostgreSQL 17.11 client verified in environment) as the single primary transactional database.
- **Rationale:** Mature ACID guarantees, row-level locking (`FOR UPDATE`) essential for atomic stock reservation, native UUIDv7 and JSONB support, extensive tooling, and rock-solid financial consistency.
- **Alternatives Considered:**
  - _MySQL 8:_ Acceptable, but less capable indexing options and JSON manipulation compared to PostgreSQL.
  - _MongoDB / Document DB:_ Inadequate for multi-entity transactional integrity, financial ledgers, and complex foreign key relations.
- **Trade-offs:** Requires careful connection pooling management (e.g., PgBouncer) under high concurrency.
- **Dependencies:** None.
- **Status:** Proposed.
- **Finalisation Gate:** G02.

---

### ADR-004: Data Access & Schema Migration Tool (Drizzle ORM)

- **Decision ID:** ADR-004
- **Topic:** ORM and Database Migration Framework
- **Current Proposed Decision:** Use **Drizzle ORM** with Drizzle Kit for declarative schema modeling and explicit, reproducible SQL migrations.
- **Rationale:** TypeScript-first, zero-runtime query overhead, transparent SQL generation, no hidden N+1 queries, excellent migration tracking, native integration with Zod schemas (`drizzle-zod`).
- **Alternatives Considered:**
  - _Prisma:_ Heavy Rust query engine binary, slower cold starts, opaque connection pooling, performance bottlenecks in high-throughput loops.
  - _TypeORM:_ Outdated typing model, reflection decorators, fragile active-record/data-mapper hybrid design.
- **Trade-offs:** Requires team familiarity with SQL-centric query composition.
- **Dependencies:** ADR-003.
- **Status:** Proposed.
- **Finalisation Gate:** G02.

---

### ADR-005: Authentication & Session Strategy

- **Decision ID:** ADR-005
- **Topic:** Authentication, Token Storage & Multi-Role Access Control
- **Current Proposed Decision:** Implement a hybrid authentication model: HTTP-only secure, `SameSite=Lax` cookies containing encrypted JWT tokens (or signed session IDs) for browser clients, with Refresh Token rotation backed by Redis/DB. Enforce strict Role-Based (Customer, Seller, Admin, Support) and Attribute-Based Access Control.
- **Rationale:** Immune to XSS token theft (unlike localStorage). Supports seamless server-side rendering (SSR) in Next.js. Refresh token rotation allows rapid session revocation upon security incidents.
- **Alternatives Considered:**
  - _Bearer tokens in localStorage:_ Vulnerable to XSS token exfiltration.
  - _Third-party SaaS (Clerk / Auth0):_ High vendor lock-in, expensive at scale, difficult to enforce tight multi-vendor database row-level relations.
- **Trade-offs:** Requires careful CSRF defense (SameSite cookies + CSRF protection headers).
- **Dependencies:** ADR-002, ADR-003.
- **Status:** Proposed.
- **Finalisation Gate:** G03.

---

### ADR-006: Multi-Tenant Seller Isolation Mechanism

- **Decision ID:** ADR-006
- **Topic:** Multi-Tenant Data Isolation & Cross-Seller Data Leak Prevention
- **Current Proposed Decision:** Enforce logical tenant isolation at the query and service boundary using explicit `seller_id` scoping predicates, backed by database constraints and NestJS interceptors/guards.
- **Rationale:** Ensures no seller can read or mutate another seller's orders, analytics, or catalog items. Centralized tenancy guards prevent developer oversight.
- **Alternatives Considered:**
  - _Separate database per tenant:_ Overkill for thousands of craftspeople, immense operational and migration overhead.
  - _PostgreSQL Row Level Security (RLS) alone:_ High complexity in pooling environments; best combined with application-level strict guards.
- **Trade-offs:** Developers must ensure every seller-scoped repository method accepts and filters by `seller_id`.
- **Dependencies:** ADR-003, ADR-005.
- **Status:** Proposed.
- **Finalisation Gate:** G03 / G04.

---

### ADR-007: Media & Private Document Storage Strategy

- **Decision ID:** ADR-007
- **Topic:** Object Storage & Document Ingestion
- **Current Proposed Decision:** Use an S3-compatible object storage architecture partitioned into two distinct buckets:
  1. `public-media`: Public CDN-cached bucket for product photos, artisan banners, and avatars.
  2. `private-documents`: Completely private bucket with zero public access for seller identity verification, tax forms, and bank certificates. Access strictly via 5-minute pre-signed URLs.
  - MinIO for local development; AWS S3 or Cloudflare R2 for staging/production.
- **Rationale:** Prevents catastrophic leakage of seller legal identity records while maximizing delivery speed and caching for public product assets.
- **Alternatives Considered:**
  - _Storing files in PostgreSQL as BLOBs:_ Bloats database size and degrades backup/restore performance.
  - _Local filesystem storage in containers:_ Ephemeral containers lose state on restarts/scaling.
- **Trade-offs:** Requires managing pre-signed upload/download ticket generation.
- **Dependencies:** None.
- **Status:** Proposed.
- **Finalisation Gate:** G04 / G05.

---

### ADR-008: Asynchronous Job Processing & Event Distribution

- **Decision ID:** ADR-008
- **Topic:** Background Processing & Transactional Outbox
- **Current Proposed Decision:** Deploy **Redis** with **BullMQ** for background job queues (email notifications, image processing, shipping sync, analytics aggregation) paired with a PostgreSQL **Transactional Outbox** pattern for domain event reliability.
- **Rationale:** Guarantees that domain events are never lost if the external queue or broker is temporarily offline. BullMQ provides mature retries, exponential backoff, rate limiting, and dead-letter queues.
- **Alternatives Considered:**
  - _Kafka / RabbitMQ:_ High infrastructure overhead for early-to-mid stage deployment.
  - _Direct in-process execution (fire-and-forget):_ Events lost on process restart; unmonitored failures.
- **Trade-offs:** Dual hop (DB outbox table -> polling/relay worker -> BullMQ queue).
- **Dependencies:** ADR-003, Redis.
- **Status:** Proposed.
- **Finalisation Gate:** G06 / G08.

---

### ADR-009: Payment Processing & Double-Entry Financial Ledger

- **Decision ID:** ADR-009
- **Topic:** Payments, Webhooks, Escrow & Ledger Accounting
- **Current Proposed Decision:** Implement an abstract Payment Provider Interface (Stripe / Razorpay adapters) with strict webhook signature verification and idempotency recording. Record all monetary movements in an append-only, double-entry financial ledger (`ledger_entries`) with platform escrow holding periods before seller payout approval.
- **Rationale:** Guaranteed idempotency prevents duplicate customer charges or double-crediting. Double-entry ledger guarantees that all marketplace fees, artisan earnings, taxes, and refunds reconcile perfectly.
- **Alternatives Considered:**
  - _Single balance column on seller table:_ Susceptible to race conditions, untraceable discrepancies, impossible to audit.
  - _Direct payout upon order placement:_ High fraud risk; fails if customer cancels or requests a return.
- **Trade-offs:** Increased database write volume for ledger journals; requires rigorous accounting logic.
- **Dependencies:** ADR-003, ADR-008.
- **Status:** Proposed.
- **Finalisation Gate:** G08 / G10.

---

### ADR-010: Courier Logistics & Shipping Integration

- **Decision ID:** ADR-010
- **Topic:** Multi-Carrier Shipping, Waybills & Tracking
- **Current Proposed Decision:** Implement an abstract Logistics Provider Interface with support for multi-vendor split shipments. Each artisan sub-order generates an independent shipment waybill and tracking number. Status updates ingested via signed webhooks.
- **Rationale:** Multi-vendor orders ship from different artisan studios across distinct geographies. Unified order tracking requires sub-order level shipment tracking.
- **Alternatives Considered:**
  - _Single shipment per order:_ Physically impossible for handcrafted goods shipped from independent artist locations.
  - _Manual tracking text field without courier API:_ Poor customer experience, high support ticket volume.
- **Trade-offs:** Higher integration complexity supporting multiple tracking lifecycles per customer order.
- **Dependencies:** ADR-002, ADR-009.
- **Status:** Proposed.
- **Finalisation Gate:** G11.

---

### ADR-011: Frontend Applications & Shared Design System

- **Decision ID:** ADR-011
- **Topic:** Frontend Architecture & Component Reuse
- **Current Proposed Decision:** Two Next.js App Router applications (`web-store` for customers, `web-portal` for sellers and admins) sharing a common UI package (`@repo/ui`) built with Tailwind CSS, Radix UI primitives, and Lucide icons.
- **Rationale:** Separating customer storefront from operational portals allows distinct performance optimization (SSR/ISR for store, highly dynamic client-side interactions for portal) while maintaining consistent brand aesthetics.
- **Alternatives Considered:**
  - _Single monolithic frontend application:_ Bloats bundle size; blends public customer routes with high-privilege administrative code.
  - _Vite SPA for portals:_ Lacks unified Next.js server actions and SSR benefits.
- **Trade-offs:** Two build outputs to manage in the monorepo pipeline.
- **Dependencies:** ADR-001.
- **Status:** Proposed.
- **Finalisation Gate:** G12 / G13 / G14.

---

### ADR-012: Comprehensive Testing & Verification Strategy

- **Decision ID:** ADR-012
- **Topic:** Testing Pipeline & Quality Assurance
- **Current Proposed Decision:** Three-tier testing pyramid:
  1. Unit tests (Vitest) for domain logic, financial math, and validation schemas.
  2. Integration tests (Supertest + Testcontainers / local Postgres) for API endpoints and database transactions.
  3. End-to-End tests (Playwright) for critical user journeys (cart checkout, seller onboarding, admin approval).
- **Rationale:** Unit tests ensure math and state machine correctness; integration tests catch database constraint and SQL errors; Playwright verifies user flows across browsers.
- **Alternatives Considered:**
  - _Unit tests only:_ Misses subtle SQL query errors and transaction rollback bugs.
  - _Mocked database integration tests:_ Inaccurate emulation of PostgreSQL row locks and transaction isolation.
- **Trade-offs:** Integration tests require running database container or service.
- **Dependencies:** ADR-001, ADR-003.
- **Status:** Proposed.
- **Finalisation Gate:** G01 (framework) / G16 (E2E).

---

### ADR-013: Deployment, Infrastructure & Containerization

- **Decision ID:** ADR-013
- **Topic:** Containerization, Environments & CI/CD
- **Current Proposed Decision:** Multi-stage Dockerfiles for all applications, orchestrated with Docker Compose for local development and Kubernetes/Container Apps for staging and production. Enforce distinct development, staging, and production environments with GitHub Actions CI workflows.
- **Rationale:** Docker ensures identical runtime environments across developer machines and cloud hosts. Multi-stage builds produce lightweight production images.
- **Alternatives Considered:**
  - _Direct bare-metal or VM node processes:_ High drift potential, difficult horizontal scaling.
  - _Serverless functions for entire NestJS backend:_ Cold start latency on complex database connection pools.
- **Trade-offs:** Requires Docker daemon in CI/CD pipeline.
- **Dependencies:** ADR-001.
- **Status:** Proposed.
- **Finalisation Gate:** G17.

---

### ADR-014: Structured Logging, Tracing & Audit Trail

- **Decision ID:** ADR-014
- **Topic:** Observability & Administrative Audit Logging
- **Current Proposed Decision:** Implement structured JSON logging (Pino) with correlation IDs (`x-request-id`, `trace-id`). Maintain an immutable PostgreSQL table `audit_logs` capturing every administrative mutation, verification status change, and manual payout intervention.
- **Rationale:** Rapid diagnosis of production errors and legal compliance for multi-vendor financial transactions and seller identity verification.
- **Alternatives Considered:**
  - _Standard console.log text strings:_ Unparseable by log aggregators (Datadog/Elasticsearch), lacks trace context.
- **Trade-offs:** Slight storage overhead for audit log table.
- **Dependencies:** ADR-002, ADR-003.
- **Status:** Proposed.
- **Finalisation Gate:** G03 / G14 / G17.

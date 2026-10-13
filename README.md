# Handcrafted Multi-Vendor Marketplace

An auditable, production-oriented multi-vendor marketplace platform empowering independent artists, artisans, and craftspeople to sell authentic handcrafted goods.

---

## 1. Monorepo Architecture

This repository is organized as a high-performance `pnpm` workspace coordinated by `Turborepo` and strict TypeScript configurations.

```
handcrafted-marketplace/
├── apps/
│   ├── storefront/          # Customer-facing responsive web application (Next.js 15)
│   ├── seller-portal/       # Artisan studio, inventory, and order fulfillment portal (Next.js 15)
│   ├── admin-portal/        # Restricted platform governance and audit console (Next.js 15)
│   └── api/                 # Modular Monolith REST API backend (NestJS 11)
├── packages/
│   ├── ui/                  # Reusable presentation components and design-system foundation
│   ├── config/              # Shared TypeScript base configs and toolchain presets
│   ├── validation/          # Shared Zod validation schemas and type guards
│   ├── api-contracts/       # Standard API response envelopes and DTO types
│   ├── db/                  # PostgreSQL 16 schemas, Drizzle ORM, migrations, and seed fixtures
│   └── shared/              # Environment-independent utilities (money arithmetic, Result monad)
├── docs/
│   ├── architecture/        # Project constitution, baseline architecture, decision registers
│   ├── implementation/      # Implementation gate reports and roadmap (G00 to G17)
│   ├── operations/          # Local development guide and runbooks
│   └── security/            # Boundary rules, secrets governance, and logging conventions
├── scripts/
│   ├── verify-repo.sh       # Comprehensive local verification script
│   └── validate-openapi.mjs # OpenAPI 3.1.0 contract validator
├── .github/
│   └── workflows/ci.yml     # Automated GitHub Actions continuous integration pipeline
├── pnpm-workspace.yaml      # Monorepo workspace definition
├── turbo.json               # Turborepo task pipeline and caching rules
└── tsconfig.base.json       # Strict root TypeScript configuration
```

---

## 2. Technology Stack & Runtimes

- **Node.js:** `>=20.0.0` (Pinned: `v24.14.1` in `.nvmrc`)
- **Package Manager:** `pnpm@11.9.0` (Enforced via `packageManager` and `.npmrc`)
- **Monorepo Engine:** `Turborepo 2.x`
- **Language:** TypeScript 5.x (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Backend API:** NestJS 11
- **Web Applications:** Next.js 15 (App Router) + React 19
- **Database Engine:** PostgreSQL 16+ with Drizzle ORM (`@repo/db`)
- **Testing Framework:** Vitest 3.x
- **Linting & Formatting:** ESLint 9 (Flat Config) + `typescript-eslint` + Prettier 3.x

---

## 3. Quick Start & Setup

### Clone and Install

```bash
# Verify runtimes
node --version # >= 20.0.0
pnpm --version # >= 10.0.0

# Install dependencies using frozen lockfile
pnpm install --frozen-lockfile

# Copy environment configuration
cp .env.example .env
```

### Development Servers

```bash
# Run all applications concurrently
pnpm dev

# Target a specific application
pnpm --filter @apps/api dev          # NestJS API (port 4000)
pnpm --filter @apps/storefront dev   # Storefront (port 3000)
pnpm --filter @apps/seller-portal dev# Seller Portal (port 3001)
pnpm --filter @apps/admin-portal dev # Admin Console (port 3002)
```

---

## 4. Quality & Verification Commands

All tasks run through Turborepo with caching:

```bash
# Format check
pnpm format:check

# Auto-format
pnpm format

# Linting
pnpm lint

# TypeScript strict typecheck
pnpm typecheck

# Automated unit tests
pnpm test

# Production build
pnpm build

# Complete verification script
./scripts/verify-repo.sh
```

---

## 5. Security & Boundary Rules

1. **Client Isolation:** Web applications (`storefront`, `seller-portal`, `admin-portal`) must never access the database directly or import backend secrets.
2. **Secrets Protection:** Only `NEXT_PUBLIC_*` variables are exposed to browsers. Server secrets (`DATABASE_URL`, `JWT_SECRET`, `S3_SECRET_KEY`) remain strictly on the backend.
3. **Integer Currency:** All financial math uses minor units (cents/paise) via `@repo/shared` to eliminate floating-point inaccuracies.
4. **Auditability:** Complete gate verification logs and architecture decisions are recorded under `docs/`.

---

## 6. Implementation Gate Status

| Gate     | Title                                                             | Status                        |
| -------- | ----------------------------------------------------------------- | ----------------------------- |
| **G00**  | Architecture Governance & Repository Discovery                    | **PASSED**                    |
| **G01**  | Monorepo Bootstrap, Toolchain & Shared Type System                | **PASSED**                    |
| **G02**  | Domain Architecture, Business Rules & API Contract Specification  | **PASSED**                    |
| **G03**  | Database Architecture, Drizzle Schema & Migration Pipeline        | **PASSED**                    |
| **G04**  | Production-Grade Authentication, Session Security & Authorisation | **PASSED**                    |
| **G05**  | Seller Onboarding, Document Verification & Shop Management        | **PASSED**                    |
| **G06**  | Product Catalogue, Listing Management & Inventory                 | **PASSED**                    |
| **G07**  | Customer Storefront, Product Discovery & Product Details          | **PASSED**                    |
| **G08**  | Shopping Cart, Checkout & Order Creation Foundation               | **PASSED**                    |
| **G07A** | Master UI/UX Design System, Design Governance & Blueprint         | **PASSED**                    |
| **G09**  | Payment Gateway, Marketplace Commissions & Financial Ledger       | **PASSED**                    |
| **G10**  | Seller Studio, Business Management & Performance Dashboard        | **PASSED**                    |
| **G11**  | Courier Integration, Shipping Operations & Order Fulfilment       | **PASSED** (Ready for Review) |

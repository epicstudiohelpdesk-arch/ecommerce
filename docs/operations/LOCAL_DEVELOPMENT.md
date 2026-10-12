# Local Development Guide

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Status:** Baseline Established (Gate G01)

---

## 1. Prerequisites

Before running the platform locally, verify the following required runtimes:

- **Node.js:** `>=20.0.0` (Recommended: `v24.14.1` as pinned in `.nvmrc`)
- **pnpm:** `>=10.0.0` (Pinned: `11.9.0`)
- **Git:** `>=2.40.0`

Check your versions:

```bash
node --version
pnpm --version
git --version
```

---

## 2. Environment Configuration

1. Copy the template `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Review local ports and endpoints:
   - **NestJS API:** `http://localhost:4000/api/v1`
   - **Customer Storefront:** `http://localhost:3000`
   - **Seller Portal:** `http://localhost:3001`
   - **Admin Portal:** `http://localhost:3002`
3. **Never commit `.env` or any file containing real credentials.** The repository `.gitignore` strictly ignores all `.env*` files except `.env.example`.

---

## 3. Installation & Dependency Management

Install all workspace dependencies using the authoritative lockfile:

```bash
pnpm install --frozen-lockfile
```

---

## 4. Development Workflows

Run development servers across all applications concurrently via Turborepo:

```bash
pnpm dev
```

Or target a specific application:

```bash
# Start only the NestJS API
pnpm --filter @apps/api dev

# Start only the customer storefront
pnpm --filter @apps/storefront dev

# Start only the seller portal
pnpm --filter @apps/seller-portal dev

# Start only the admin portal
pnpm --filter @apps/admin-portal dev
```

---

## 5. Quality & Verification Commands

Run workspace-wide tasks:

```bash
# Check code formatting with Prettier
pnpm format:check

# Automatically format all files
pnpm format

# Run ESLint with TypeScript rules across all packages
pnpm lint

# Run strict TypeScript type check without emitting files
pnpm typecheck

# Run unit tests across all test suites with Vitest
pnpm test

# Build all applications and packages for production
pnpm build
```

Alternatively, execute the complete local verification script:

```bash
./scripts/verify-repo.sh
```

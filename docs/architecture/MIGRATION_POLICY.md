# Database Migration Policy & Operational Protocol

**Document Version:** 1.0.0  
**Effective Date:** Gate G03 Baseline  
**Tooling:** Drizzle Kit (`drizzle-kit`) & Drizzle Migrator  
**Status:** Canonical Operational Policy

---

## 1. Single Authoritative Migration History

All database schema evolutions must be tracked through version-controlled SQL migration scripts located in [`packages/db/migrations`](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/packages/db/migrations).

### Invariants:

1. **Never Edit Past Migrations:** Once a migration has been applied or committed to `main`, its SQL content is strictly immutable. Alterations must be performed via a subsequent forward migration.
2. **Schema & Migration Alignment:** Drizzle ORM TypeScript schema definitions (`packages/db/src/schema/*.ts`) and generated SQL migrations (`packages/db/migrations/*.sql`) must never silently diverge.
3. **Reproducibility:** A clean PostgreSQL 16 database must be fully constructible by running the migration sequence up from scratch.

---

## 2. Zero-Downtime: Expand-and-Contract Technique

Production schema modifications must not take down the platform or break in-flight transactions. All breaking changes (renaming columns, changing types, splitting tables) must follow the **Expand-and-Contract** pattern across consecutive gates/releases:

```mermaid
sequenceDiagram
    participant App as Application (V1 / V2)
    participant DB as PostgreSQL Database

    Note over DB: Phase 1: Expand
    DB->>DB: Add new column (nullable or default) via Migration
    App->>DB: App V1 writes to old column; App V2 dual-writes

    Note over DB: Phase 2: Backfill
    DB->>DB: Batch backfill data from old column to new column

    Note over DB: Phase 3: Switch Reads
    App->>DB: App V2 reads exclusively from new column

    Note over DB: Phase 4: Contract
    DB->>DB: Drop old column via subsequent migration
```

### Prohibited Operations in Single Migrations:

- `ALTER TABLE ... DROP COLUMN ...` without a prior release deprecating its use.
- `ALTER TABLE ... RENAME COLUMN ...` directly (causes instant crashes for running application pods).
- Adding `NOT NULL` columns without a `DEFAULT` or a phased backfill.
- Long-running unindexed foreign key checks or table locks during peak hours.

---

## 3. Migration Runner Protocol

1. **Local Development:**
   ```bash
   # Generate migration diff
   pnpm --filter @repo/db db:generate

   # Apply to local dev database
   pnpm --filter @repo/db db:migrate
   ```
2. **CI Pipeline Verification:**
   - Every pull request executes migrations against an isolated PostgreSQL container.
   - Tests verify that `drizzle-kit generate` produces no diff against the schema.
3. **Production Deployment:**
   - Migrations are applied in a pre-deployment step prior to rolling out new application pods.
   - Migrations must complete with exit code 0 before new pods receive traffic.
   - Automated database resets (`DROP DATABASE`, `truncate`) are strictly forbidden in production.
   - Development seed scripts must NEVER run against production environments.

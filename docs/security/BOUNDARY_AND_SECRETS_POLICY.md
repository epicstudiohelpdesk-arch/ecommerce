# Boundary, Dependency & Secrets Governance Policy

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G01  

---

## 1. Package Dependency & Boundary Rules

To prevent architectural degradation, circular couplings, and security leaks, package dependencies are governed by the following hierarchy:

```
[apps/api]           [apps/storefront]       [apps/seller-portal]      [apps/admin-portal]
   │                         │                        │                         │
   ├───────────┬─────────────┴───────────┬────────────┴─────────────┬───────────┤
   ▼           ▼                         ▼                          ▼           ▼
[@repo/ui]  [@repo/api-contracts]   [@repo/validation]         [@repo/shared]  [@repo/config]
```

### Dependency Invariants
1. **Frontend Packages Never Import Backend Secrets:** `@repo/ui`, `@repo/shared`, and frontend applications must never import database drivers, ORM schemas, JWT signing keys, payment provider private secrets, or administrative backend credentials.
2. **No Database Access from Web Apps:** Browser applications (`apps/storefront`, `apps/seller-portal`, `apps/admin-portal`) must interact with business data exclusively via HTTPS calls to `apps/api`. Direct SQL connections or ORM imports from browser bundles are prohibited.
3. **No Circular Dependencies:** A package in `packages/` cannot depend on another package that depends back on it, nor may any shared package import from `apps/*`.
4. **Permitted Cross-Imports:**
   - `@repo/ui`: Presentation components only; depends on React primitives.
   - `@repo/shared`: Pure utilities; zero dependencies.
   - `@repo/validation`: Relies on `@repo/shared` and `zod`.
   - `@repo/api-contracts`: Relies on `@repo/shared` and `@repo/validation`.
   - `@apps/*`: May import from `@repo/shared`, `@repo/validation`, `@repo/api-contracts`, and `@repo/ui` as appropriate.

---

## 2. Environment Variables & Secret Separation

1. **Prefix Discipline:** Only variables prefixed with `NEXT_PUBLIC_` may be exposed to the client browser bundle. Any variable containing credentials, connection strings, private keys, or API tokens must NOT use `NEXT_PUBLIC_`.
2. **Server-Only Variables:**
   - `DATABASE_URL` (PostgreSQL connection string with credentials)
   - `REDIS_URL` (Redis connection string)
   - `JWT_SECRET` (Cryptographic signing secret)
   - `COOKIE_SECRET` (Session cookie encryption key)
   - `S3_ACCESS_KEY` & `S3_SECRET_KEY` (Object storage credentials)
   - Payment and courier private API keys (future gates)
3. **Fail-Fast Validation:** In runtime services, required environment variables must be validated on process startup using Zod or a NestJS ConfigService schema, exiting immediately if missing.
4. **Exclusion from VCS:** `.gitignore` strictly excludes all `.env*` files except `.env.example`.

---

## 3. Error Handling and Logging Conventions

1. **No Sensitive Data in Logs:** Passwords, tokens, payment card details, and tax identity documents must never be printed in log messages or stack traces.
2. **Correlation IDs:** Every incoming HTTP request must receive or generate an `x-request-id` header. This correlation ID must be attached to:
   - Structured JSON server log entries
   - Outgoing HTTP error responses (`meta.correlationId`)
   - Downstream outbox and job queue payloads
3. **Standard RFC 7807 Error Envelope:** All backend API errors must conform to `@repo/api-contracts`'s `ApiErrorResponse` structure:
   ```json
   {
     "success": false,
     "error": {
       "code": "ENTITY_NOT_FOUND",
       "message": "The requested item was not found",
       "correlationId": "req-98f2b3",
       "timestamp": "2026-10-12T01:00:00.000Z"
     }
   }
   ```
4. **Sanitized Client Errors:** Database errors (such as unique constraint violations, foreign key errors, SQL syntax errors) must be intercepted by global NestJS exception filters and translated into generic, client-safe error messages without exposing schema details.

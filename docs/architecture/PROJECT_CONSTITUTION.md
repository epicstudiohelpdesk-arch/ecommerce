# Engineering Constitution: Handcrafted Multi-Vendor Marketplace

**Document Version:** 1.0.0  
**Effective Date:** Gate G00 Baseline  
**Status:** Approved Architectural Baseline

---

## 1. Purpose and Philosophy

This Constitution defines the non-negotiable architectural axioms, security standards, financial integrity invariants, and operational principles governing the engineering and lifecycle of the **Handcrafted Multi-Vendor Marketplace**.

The platform is designed to empower independent artists, artisans, and craftspeople to present and sell authentic, handcrafted physical goods—including woodwork, canvas art, ceramics, handcrafted jewelry, textiles, sculptures, and bespoke creations.

Because this platform processes multi-vendor financial transactions, sensitive legal identities, tax documents, and multi-party logistics, software development must be guided by **verifiable engineering discipline**, **evidence-first verification**, and **zero-tolerance for data corruption**.

---

## 2. Non-Negotiable Core Principles

### Principle 1: PostgreSQL is the Single Source of Truth

PostgreSQL is the definitive source of truth for all transactional business data, including user identities, seller states, catalog records, inventory balances, order states, and financial ledgers. No peripheral system (such as Redis or Elasticsearch) shall be treated as an authoritative source of truth for transactional states or balances.

### Principle 2: Strict Server-Side Business Rule Enforcement

Client applications (customer web storefront, seller dashboard, admin console) are untrusted presentation tiers. All authorization, catalog moderation, pricing calculation, inventory allocation, discount application, order state transitions, commission splits, and payout approvals must be executed and validated strictly on the server within backend domain services.

### Principle 3: Absolute Multi-Tenant Isolation

The platform is a multi-vendor ecosystem. Sellers must never be permitted to read, modify, intercept, or infer another seller's orders, customer details, financial balance, bank records, private documents, or analytics. Every seller-scoped query, mutation, and background job must enforce cryptographic or database-level tenant boundary predicates.

### Principle 4: Immutable, Double-Entry Financial Ledger

Money movements—including payments, marketplace commissions, seller reserves, refunds, courier charges, adjustments, and payouts—must be recorded in an immutable, append-only ledger following double-entry bookkeeping principles. Balances are computed or reconciled from ledger journal entries; balances must never be arbitrarily updated by raw mutation without corresponding journal entries.

### Principle 5: Idempotent and Fault-Tolerant External Integrations

All external webhook endpoints (payment gateways, courier status updates) and background message consumers must be inherently idempotent. Webhooks must record a unique event idempotency key and execute within database transactions. Replayed, delayed, or out-of-order events must not cause duplicate payments, repeated inventory increments/decrements, or duplicate seller payouts.

### Principle 6: Atomic Order & Inventory Reservations (Zero Overselling)

Inventory reservation during checkout must be atomic and race-condition free. Handcrafted items are often unique, one-of-a-kind (stock = 1) or produced in extremely small batches. Overselling damages artisan credibility. Inventory decrements must utilize database-level row locking (`SELECT FOR UPDATE`), conditional updates, or atomic stored procedures to guarantee that stock never drops below zero under concurrent traffic.

### Principle 7: Separation of Concerns via Modular Monolith

The architecture shall be organized as a **Modular Monolith** with clear domain boundaries, clean module interfaces, and explicit dependency hierarchies. Direct cross-domain table joins or cyclic service couplings are prohibited; inter-module interactions must occur through defined internal domain service contracts. Microservices are rejected at this stage to prevent distributed transaction overhead and operational complexity.

### Principle 8: Defense-in-Depth Security & Least Privilege

Sensitive seller verification documents (government IDs, tax registrations, business certificates) must be stored in secure, access-restricted private S3 buckets. Direct public URLs to private documents are strictly forbidden. Access must require short-lived, pre-signed URLs generated only after explicit administrative authorization. Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) must govern all endpoints.

### Principle 9: Evidence-First Verification

No feature, bugfix, or gate deliverable shall be declared complete based on assumption. Completion requires concrete proof: passing automated test suites, executed schema migrations, verified type checks, lint checks, and reproducible logs. Claims without verifiable terminal or CI evidence are null and void.

### Principle 10: Strict Gate-by-Gate Governance

Development must proceed sequentially through defined gates (G00 to G17). No gate may begin until its predecessor has met all Definition of Done requirements and received explicit human approval. Premature feature implementation outside the active gate scope is prohibited.

---

## 3. Data Integrity & Financial Invariants

1. **Sum of Debits Equals Sum of Credits:** Every financial transaction must be balanced (`Σ Debits = Σ Credits = 0` or balanced asset/liability/equity accounts).
2. **Never Hard-Delete Core Business Entities:** Users, shops, products, orders, ledger entries, and audit logs must never be deleted using SQL `DELETE`. Use soft-deletes (`deleted_at` timestamp) or state flags (`ARCHIVED`, `SUSPENDED`).
3. **State Machine Integrity:** Orders, payments, shipments, and payouts must follow formal deterministic state machines. Invalid transitions (e.g., transitioning an order directly from `PENDING_PAYMENT` to `DELIVERED`, or issuing a payout for a `CANCELLED` order) must be rejected with domain exceptions.
4. **Resilient Transaction Outbox:** Inter-service events (notifications, analytics events, search index updates, external webhook dispatches) that accompany a database change must be persisted atomically to an `outbox_events` table within the primary database transaction before being dispatched asynchronously.

---

## 4. Code Quality & Standards

1. **Strict TypeScript:** `noImplicitAny`, `strictNullChecks`, and `noUncheckedIndexedAccess` enabled across all packages. Avoid the `any` escape hatch; use `unknown` with runtime Zod guards.
2. **Input Validation:** Every HTTP request payload, query parameter, and path variable must be validated at the boundary using Zod or validated DTO schemas with class-validator.
3. **Error Handling:** Standardized RFC 7807 Problem Details error responses across all REST APIs. No internal database error traces, stack traces, or credentials shall leak to client responses.
4. **Structured Logging:** Structured JSON logging (using Pino or Winston) with contextual trace IDs (`trace_id`, `user_id`, `request_id`) on all requests and background job executions. Sensitive fields (passwords, tokens, card numbers, tax IDs) must be sanitized.

---

## 5. Amendments & Evolution

This Constitution may only be amended through formal Architecture Decision Records (ADRs) approved by the principal software architect and engineering leads.

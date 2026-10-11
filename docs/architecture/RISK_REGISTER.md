# Initial Risk Register: Handcrafted Multi-Vendor Marketplace

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G00 Baseline  
**Review Cycle:** Updated at each subsequent gate

---

## 1. Risk Evaluation Matrix

| Likelihood \ Severity | Low        | Medium | High     | Critical |
| --------------------- | ---------- | ------ | -------- | -------- |
| **High**              | Medium     | High   | Critical | Critical |
| **Medium**            | Low        | Medium | High     | Critical |
| **Low**               | Negligible | Low    | Medium   | High     |

---

## 2. Core Risk Register

### R-01: Cross-Seller Data Leakage

- **Risk Description:** A seller accesses, modifies, or views another seller's orders, customer personal data, earnings, bank details, or inventory through manipulated API parameters (IDOR) or missing tenant predicates in SQL queries.
- **Severity:** Critical
- **Likelihood:** Medium
- **Affected Subsystem:** IAM, Seller Dashboard, Sub-Orders, Inventory, Financial Ledger.
- **Mitigation Direction:**
  1. Enforce automated tenant context extraction from authenticated session tokens.
  2. Implement global NestJS guards and repository-level multi-tenant query filters requiring `seller_id = session.seller_id`.
  3. Strict unit and integration tests specifically testing cross-tenant IDOR access attempts with simulated hostile seller credentials.
- **Responsible Gate:** G03 (IAM foundation), G04 (Seller onboarding), G09 (Sub-orders), G13 (Seller Dashboard).

---

### R-02: Authentication and Privileged-Access Weaknesses

- **Risk Description:** Privilege escalation where a customer or seller gains administrative privileges, or session hijacking occurs due to insecure token storage or missing CSRF protections.
- **Severity:** Critical
- **Likelihood:** Low
- **Affected Subsystem:** Identity & Access Management (IAM), Admin Console.
- **Mitigation Direction:**
  1. Store tokens exclusively in secure, HTTP-only, `SameSite=Lax` cookies with strict rotation on refresh.
  2. Implement strict hierarchical RBAC (Customer, Seller, Support, Finance, SuperAdmin) verified at the controller and method decorator level.
  3. Maintain immutable audit logging for all privilege changes and administrative actions.
- **Responsible Gate:** G03 (Auth & RBAC), G14 (Admin Console).

---

### R-03: Duplicate Payment or Webhook Processing

- **Risk Description:** Network retries, concurrent webhook deliveries from payment gateways, or customer double-clicking causes duplicate payment processing, double-crediting balances, or duplicate order fulfillment.
- **Severity:** Critical
- **Likelihood:** High
- **Affected Subsystem:** Payments, Orders, Financial Ledger.
- **Mitigation Direction:**
  1. Assign unique idempotency keys to checkout payment intents.
  2. Persist incoming webhook event IDs into a dedicated `payment_webhook_events` table within a serializable database transaction; ignore subsequent arrivals of known event IDs.
  3. Enforce deterministic state transitions (e.g., payment can only transition to `CAPTURED` from `PENDING`).
- **Responsible Gate:** G08 (Payment Gateway Integration).

---

### R-04: Incorrect Commission or Payout Calculations

- **Risk Description:** Rounding discrepancies, miscalculated marketplace percentage commissions, failure to account for shipping fees or discounts, resulting in incorrect payout amounts or financial loss.
- **Severity:** High
- **Likelihood:** Medium
- **Affected Subsystem:** Pricing Engine, Financial Ledger, Payout Engine.
- **Mitigation Direction:**
  1. Use integer arithmetic representing minor currency units (cents/paise) or PostgreSQL `NUMERIC(14, 4)` for all money calculations. Floating-point types (`float`, `double`) are strictly prohibited for financial data.
  2. Implement double-entry ledger journals where platform fee + artisan share = sub-order net total.
  3. Comprehensive unit test suites with property-based testing covering boundary fee scenarios and rounding edges.
- **Responsible Gate:** G07 (Pricing Engine), G10 (Financial Ledger & Payouts).

---

### R-05: Overselling Inventory During Concurrent Checkouts

- **Risk Description:** Multiple buyers attempt to purchase the same unique handcrafted item (stock = 1) simultaneously, leading to negative stock and fulfillment failure.
- **Severity:** High
- **Likelihood:** High
- **Affected Subsystem:** Inventory Management, Cart & Checkout.
- **Mitigation Direction:**
  1. Atomic inventory reservations using PostgreSQL `SELECT FOR UPDATE` or conditional SQL updates (`UPDATE inventory SET stock = stock - qty WHERE sku = :sku AND stock >= qty`).
  2. Temporary reservation hold (e.g., 15 minutes) during checkout session; automatic release worker for abandoned checkouts.
  3. Concurrency integration testing simulating simultaneous checkouts on a single inventory item.
- **Responsible Gate:** G06 (Inventory Management), G07 (Checkout).

---

### R-06: Partial Failure During Order Creation

- **Risk Description:** In a multi-vendor checkout containing items from multiple artisans, the parent order is created but one sub-order fails, or payment is captured but sub-order creation fails.
- **Severity:** High
- **Likelihood:** Medium
- **Affected Subsystem:** Checkout, Order Decomposition, Payments.
- **Mitigation Direction:**
  1. Wrap parent order creation, sub-order splitting, and inventory decrement within an atomic database transaction.
  2. Implement compensating transaction workflows / Saga pattern for external payment failures.
  3. Comprehensive integration tests verifying transaction rollback upon failure during any sub-order step.
- **Responsible Gate:** G08 (Payments), G09 (Order Splitting).

---

### R-07: Courier Tracking Inconsistencies

- **Risk Description:** External courier API outages, delayed webhook status pushes, or format changes cause discrepancies between actual delivery status and platform order status, delaying seller payout clearance.
- **Severity:** Medium
- **Likelihood:** High
- **Affected Subsystem:** Shipping & Logistics, Orders, Payouts.
- **Mitigation Direction:**
  1. Courier gateway abstraction with normalized internal shipment statuses (`LABEL_CREATED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURNED`).
  2. Fallback polling worker for shipments that haven't received webhook updates within 24 hours.
  3. Manual admin override mechanism with audit logging for stuck tracking numbers.
- **Responsible Gate:** G11 (Courier Logistics).

---

### R-08: Refund and Return Accounting Errors

- **Risk Description:** When a customer returns an item from one artisan in a multi-item order, the platform mistakenly debits another artisan, fails to refund customer shipping, or leaves escrow balances in an unbalanced state.
- **Severity:** High
- **Likelihood:** Medium
- **Affected Subsystem:** Returns & Disputes, Financial Ledger, Payout Engine.
- **Mitigation Direction:**
  1. Refunds must be explicitly linked to the specific artisan `SubOrder` and recorded as reverse journal entries in the double-entry ledger.
  2. Platform commission clawback rules clearly defined and coded in ledger transactions.
  3. Prevent seller payout dispatch until the return window (e.g., 7 or 14 days post-delivery) has expired.
- **Responsible Gate:** G10 (Ledger), G15 (Disputes & Returns).

---

### R-09: Exposure of Seller Documents and Customer Data

- **Risk Description:** Artisan government IDs, tax certificates, bank statements, or customer physical home addresses are leaked via publicly accessible cloud storage URLs, verbose error logs, or insecure endpoints.
- **Severity:** Critical
- **Likelihood:** Medium
- **Affected Subsystem:** Seller Onboarding, Media Storage, Customer Management.
- **Mitigation Direction:**
  1. Private S3 bucket with strict zero-public-access policy for all KYC files.
  2. Access only via authenticated backend endpoints issuing temporary pre-signed URLs (maximum 5-minute TTL).
  3. Automatic log sanitization filters in Pino/Winston masking address lines, tax IDs, and document keys.
- **Responsible Gate:** G04 (Seller Onboarding), G05 (Media Storage), G14 (Admin).

---

### R-10: Unreliable Backups or Failed Recovery

- **Risk Description:** Database corruption, accidental data truncation, or storage loss occurs without verified, automated backups and tested point-in-time recovery (PITR).
- **Severity:** Critical
- **Likelihood:** Low
- **Affected Subsystem:** Database Infrastructure, DevOps.
- **Mitigation Direction:**
  1. Automated daily snapshots plus continuous Write-Ahead Log (WAL) archiving for Point-in-Time Recovery.
  2. Documented and tested disaster recovery restore runbook.
  3. Automated checksum verification on backup artifacts.
- **Responsible Gate:** G02 (Database Setup), G17 (Production Readiness).

---

### R-11: Dependency and Deployment Risks

- **Risk Description:** Outdated or vulnerable third-party npm packages introduce remote code execution; differing Node.js runtime versions cause subtle production discrepancies.
- **Severity:** High
- **Likelihood:** Medium
- **Affected Subsystem:** Build Toolchain, CI/CD Pipeline.
- **Mitigation Direction:**
  1. Strict `pnpm` lockfile enforcement (`pnpm install --frozen-lockfile` in CI).
  2. Automated dependency vulnerability scanning (`pnpm audit` / GitHub Dependabot).
  3. Containerized runtime pinning Node.js version across development, CI, and production Docker images.
- **Responsible Gate:** G01 (Monorepo Toolchain), G16 (Security Hardening), G17 (CI/CD).

---

### R-12: Regulatory, Tax and Payment-Provider Compliance Assumptions

- **Risk Description:** Launching without compliant GST/VAT invoicing, violating marketplace platform liability regulations, or failing payment gateway KYC requirements for marketplace split disbursements.
- **Severity:** High
- **Likelihood:** High
- **Affected Subsystem:** Seller Onboarding, Financial Ledger, Admin Reporting.
- **Mitigation Direction:**
  1. Collect and validate artisan tax identification numbers (e.g., GSTIN / PAN / VAT / SSN) during onboarding.
  2. Modular tax calculation engine supporting region-specific tax invoices for both artisan goods and platform commissions.
  3. Integrate payment gateway Marketplace/Connect APIs (e.g., Stripe Connect Custom/Express or Razorpay Route) that handle legal payout compliance.
- **Responsible Gate:** G04 (Seller Onboarding), G07 (Tax Calculation), G08 (Payments), G10 (Payouts).

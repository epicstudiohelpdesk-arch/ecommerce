# GATE G09 COMPLETION REPORT

## Payment Gateway, Marketplace Commissions & Financial Ledger

**Project:** Handcrafted Multi-Vendor Marketplace  
**Gate:** G09  
**Gate Status:** **PASS (Pending Human Review)**  
**Prerequisites:** G00 through G08 (including G07A) APPROVED & VERIFIED  
**Next Gate:** G10 (Seller Order Management, Fulfillment & Shipping Foundation)

---

## 1. Executive Summary

Gate G09 establishes the production-grade payment gateway integration, server-authoritative marketplace commission engine, double-entry financial accounting ledger, cryptographic webhook ingestion, automated reconciliation audit, and customer payment experience for the handcrafted marketplace.

Customers completing checkout are guided seamlessly from placed orders to verified payment capture across multiple payment methods (India-first UPI, Credit/Debit Cards, and NetBanking via Razorpay, as well as Stripe for international expansion). All financial calculations strictly operate in integer minor units (INR paise) with zero floating-point math.

In strict compliance with the platform constitution, financial security rules, and gate boundaries:

- **Authoritative Capture Only:** No order is ever marked `PAID` without authoritative cryptographic confirmation from the payment provider (via timing-safe HMAC webhook or gateway callback signature verification).
- **Zero Raw Card Data (PCI DSS):** No raw card numbers, CVVs, or bank credentials ever touch or reside in platform storage or database tables.
- **Strict Double-Entry Ledger Invariant:** Every captured transaction, platform commission allocation, and customer refund generates balanced append-only journal entries strictly obeying:
  $$\sum \text{Debits} \equiv \sum \text{Credits}$$
- **Exact Financial Conservation:** Platform commissions and seller escrow allocations satisfy:
  $$\text{netSellerPayable} + \text{commissionFee} + \text{tax} \equiv \text{itemSubtotal} + \text{shippingFee}$$
- **Zero Premature Scope Creep:** Automated bank payout disbursements and courier logistics bookings are strictly deferred to subsequent gates (G10/G11).

---

## 2. Implemented Capabilities & Deliverables

### 2.1 Domain Validation & Contracts (`packages/validation` & `packages/api-contracts`)

- **Validation Schemas (`packages/validation/src/payments.ts`):**
  - `initiatePaymentSchema`: Validates order number, payment provider (`RAZORPAY`, `STRIPE`), optional return URL, and client metadata.
  - `verifyPaymentSchema`: Validates provider payment ID, order ID, and HMAC signatures (`razorpaySignature`, `stripePaymentIntentId`).
  - `refundRequestSchema`: Validates sub-order ID, positive refund amount in minor units, reason codes (`CUSTOMER_RETURN`, `DEFECTIVE_ITEM`, `CANCELLATION`, etc.), and detailed notes.
  - `processRefundSchema`: Validates admin approval/rejection actions and audit notes.
- **Shared API Contracts (`packages/api-contracts/src/payments.ts`):**
  - DTOs for `PaymentInitiationResultDto`, `PaymentVerificationResultDto`, `PaymentStatusDto`, `PaymentAttemptDto`, `RefundDto`, `SellerBalanceStatementDto`, `LedgerEntryDto`, and `ReconciliationReportDto`.
  - Broadened `PaymentStatus` union in `packages/api-contracts/src/checkout.ts` to support all financial states (`PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`).

### 2.2 Payment Provider Architecture (`apps/api/src/modules/payments/`)

- **Standard Payment Provider Port (`interfaces/payment-provider.interface.ts`):**
  - Uniform `IPaymentProvider` abstraction defining intent creation, cryptographic webhook verification, checkout callback signature verification, payment status lookup, and refund execution.
- **Razorpay Adapter (`providers/razorpay.provider.ts`):**
  - Implements Razorpay Orders API, checkout signature verification (`HMAC-SHA256(order_id + "|" + payment_id, secret)` using timing-safe buffer comparison), webhook HMAC verification (`x-razorpay-signature`), and refund creation.
- **Stripe Adapter (`providers/stripe.provider.ts`):**
  - Implements Stripe PaymentIntents API, `t=...,v1=...` timestamp-based signature verification to guard against replay attacks, and refund execution.
- **Mock Payment Adapter (`providers/mock.provider.ts`):**
  - Deterministic test provider used in CI and isolated unit tests with HMAC generation and predictable intent IDs.

### 2.3 Marketplace Commission Engine (`apps/api/src/modules/payments/commission.service.ts`)

- **Server-Authoritative Commission Rules:**
  - 10% platform commission on item subtotal (customizable per category or seller agreement).
  - Exact financial conservation without rounding drift.
  - Pro-rata commission refund calculations for partial and full returns:
    $$\text{commissionRefundMinor} = \text{round}\left(\text{refundMinor} \times \frac{\text{commissionMinor}}{\text{subtotalMinor} + \text{shippingMinor}}\right)$$
    $$\text{sellerClawbackMinor} = \text{refundMinor} - \text{commissionRefundMinor}$$

### 2.4 Double-Entry Financial Ledger Engine (`apps/api/src/modules/ledger/`)

- **Standard Chart of Accounts:**
  - `1010_PAYMENT_PROCESSOR` (Asset): Gateway clearing account.
  - `2010_CUSTOMER_ESCROW` (Liability): Escrow held for pending customer orders.
  - `2020_SELLER_PAYABLE` (Liability): Released payable balance for completed orders.
  - `2030_CUSTOMER_REFUND` (Liability): Pending refund liabilities.
  - `2040_TAXES_PAYABLE` (Liability): Platform tax obligations.
  - `4010_MARKETPLACE_COMMISSION` (Revenue): Earned marketplace commissions.
  - `5010_GATEWAY_FEES` (Expense): Payment processor interchange fees.
- **Ledger Invariant Enforcement (`LedgerService.postBalancedJournalBatch`):**
  - Atomically validates that $\sum \text{Debits} == \sum \text{Credits}$ before any write.
  - Rejects unbalanced batches with `BadRequestException` and rolls back the database transaction.
  - Manages `seller_balances.pendingEscrowMinor` credit upon payment capture and debit upon return/refund.
- **Seller Financial Endpoints (`LedgerController`):**
  - `GET /seller/finance/balance`: Real-time artisan balance statement (available, pending escrow, held in dispute, lifetime paid).
  - `GET /seller/finance/ledger`: Paginated, immutable audit trail of journal entries for the authenticated artisan.

### 2.5 Transactional Payment Lifecycle & Webhooks (`apps/api/src/modules/payments/`)

- **Lifecycle Flow:**
  1. `POST /payments/initiate`: Creates pending `payment_attempts` with sub-order allocations and generates provider intent.
  2. `POST /payments/webhooks/:provider`:
     - Verifies cryptographic HMAC header using timing-safe comparisons.
     - Computes SHA256 hash of raw payload for idempotency.
     - Inserts into `payment_webhook_events` with deduplication check.
     - Triggers atomic `executePaymentCapture` or `executePaymentFailure`.
  3. `POST /payments/verify`: Customer-facing callback verification for frontend checkout handoff.
  4. `POST /payments/refund` & `POST /admin/finance/refunds/:refundId/process`: Over-refund guarded refund lifecycle with gateway dispatch and ledger reversal.
- **Automated Reconciliation Audit (`ReconciliationService`):**
  - Scans for stale initiated attempts (> 60 minutes) and amount mismatches.
  - Verifies unprocessed/failed webhook backlog.
  - Mathematically verifies that every journal batch in `ledger_entries` satisfies $\sum \text{Debits} - \sum \text{Credits} \equiv 0$.
  - Exposed via `GET /admin/finance/reconciliation`.

### 2.6 Customer Storefront Payment UI (`apps/storefront`)

- **Checkout Payment Page (`/checkout/payment?orderNumber=...`):**
  - Fetches order details, presents selected payment methods (UPI, Cards, NetBanking).
  - Interacts with payment gateway and displays sandbox/production payment flow.
  - Handles declined attempts with a failure alert and instant retry mechanism.
- **Checkout Success Page (`/checkout/success?orderNumber=...`):**
  - Polls live order status until `paymentStatus: 'PAID'` and `orderStatus: 'PROCESSING'`.
  - Displays confirmed artisan sub-orders, delivery address, and payment method details.

### 2.7 OpenAPI 3.1 Specification (`docs/api/OPENAPI.yaml`)

- Fully documented all 7 payment, webhook, seller financial, and admin reconciliation endpoints with request/response schemas, error schemas, and security schemes (`cookieAuth`, `bearerAuth`, `webhookSignatureAuth`).
- 61 total API paths, 279 resolved `$ref` references, 100% compliant.

---

## 3. Test Coverage & Verification Evidence

All automated test suites pass across the entire monorepo:

| Test Suite                                                                    | Result                  | Details                                                                                                                                            |
| :---------------------------------------------------------------------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payment Integration Tests** (`apps/api/test/payments.integration.spec.ts`)  | **8 / 8 PASS**          | Intent initiation, idempotent capture, state coordination, double-entry batch verification, webhook processing, refund calculation, reconciliation |
| **Ledger Service Unit Tests** (`apps/api/test/ledger.service.spec.ts`)        | **6 / 6 PASS**          | Balanced journal batch posting, unbalanced batch rejection, escrow credits/debits, balance statements                                              |
| **Payment Provider Unit Tests** (`apps/api/test/payment-providers.spec.ts`)   | **9 / 9 PASS**          | Razorpay, Stripe, and Mock intent creation, HMAC signature verification, tamper rejection, refund flows                                            |
| **Commission Engine Unit Tests** (`apps/api/test/commission.service.spec.ts`) | **5 / 5 PASS**          | 10% commission math, multi-sub-order aggregation, exact conservation, pro-rata refund calculations                                                 |
| **All API Tests** (`apps/api/test/*.spec.ts`)                                 | **114 / 114 PASS**      | Across all 14 test suites in `apps/api`                                                                                                            |
| **Storefront Tests** (`apps/storefront/test/storefront.spec.ts`)              | **20 / 20 PASS**        | Payment status polling, checkout payment routing, currency formatting, stock fallbacks                                                             |
| **Validation Schema Tests** (`packages/validation/test/*.test.ts`)            | **29 / 29 PASS**        | Payment input schemas, refund schemas, address schemas, auth schemas                                                                               |
| **Database Tests** (`packages/db/test/*.test.ts`)                             | **15 / 15 PASS**        | Schema integrity, migrations, inventory row locks, ledger invariants                                                                               |
| **Repository Typecheck** (`turbo typecheck`)                                  | **PASS (9/9 packages)** | 0 TypeScript errors                                                                                                                                |
| **Repository Lint** (`turbo lint`)                                            | **PASS (9/9 packages)** | 0 ESLint errors                                                                                                                                    |
| **Prettier Formatting** (`pnpm format:check`)                                 | **PASS**                | 100% formatted                                                                                                                                     |
| **OpenAPI Specification** (`scripts/validate-openapi.mjs`)                    | **PASS**                | 61 paths, 279 references, 100% valid OpenAPI 3.1                                                                                                   |

---

## 4. Architectural Invariants Enforced

1. **Double-Entry Balance Invariant:**
   $$\sum_{i \in \text{Batch}} \text{Debit}_i \equiv \sum_{i \in \text{Batch}} \text{Credit}_i$$
   Every journal batch is balanced to the exact minor unit (paise). Unbalanced entries are mathematically impossible to commit.
2. **Authoritative Capture:**
   Orders transition to `PAID` and `PROCESSING` only upon cryptographically verified gateway events or timing-safe HMAC webhook confirmations.
3. **Webhook Idempotency:**
   Each incoming provider event is verified cryptographically, checked against `payment_webhook_events` via unique `(provider, eventId)` and payload hash, ensuring replay attacks cause zero side effects.
4. **Over-Refund Prevention:**
   $$\sum \text{Refunds}_{\text{subOrder}} \le \text{CapturedAmount}_{\text{subOrder}}$$
   Any excess refund attempt is rejected with `BadRequestException`.
5. **Data Protection & Compliance:**
   Zero raw card numbers, CVVs, or cardholder banking credentials stored. Full PCI DSS SAQ A alignment.

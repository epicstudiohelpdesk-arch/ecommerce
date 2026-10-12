# Role-Based & Object-Level Authorization Matrix

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G02 Baseline  
**Security Model:** Defense-in-Depth RBAC + Object-Level Tenancy ABAC

---

## 1. Actor Roles Hierarchy

1. **Anonymous Visitor (`ANON`):** Unauthenticated guest browsing public listings and shops.
2. **Customer (`CUST`):** Authenticated buyer managing cart, orders, and addresses.
3. **Approved Seller (`SELLER_APP`):** Verified artisan operating an active handcrafted storefront.
4. **Seller Pending Verification (`SELLER_PEND`):** Artisan applicant who has submitted KYC, awaiting compliance review.
5. **Restricted / Suspended Seller (`SELLER_SUSP`):** Artisan under policy sanction or dispute investigation.
6. **Customer Support Agent (`SUPPORT`):** Platform staff resolving buyer disputes and ticket issues.
7. **Marketplace Manager (`MANAGER`):** Operational staff managing product moderation and category taxonomies.
8. **Finance Operator (`FINANCE`):** Accounting staff managing payouts, tax reports, and refund approvals.
9. **Trust & Safety Operator (`SAFETY`):** Compliance staff reviewing artisan KYC and prohibited item reports.
10. **Read-Only Analyst (`ANALYST`):** BI/Analytics staff accessing aggregated non-PII marketplace metrics.
11. **Super Administrator (`SUPER_ADMIN`):** Privileged system owners managing staff access and configuration.

---

## 2. Role-Resource-Action Matrix

| Resource / Action                      |  ANON  | CUST  | SELLER_APP | SELLER_PEND | SELLER_SUSP | SUPPORT | MANAGER | FINANCE | SAFETY | ANALYST | SUPER_ADMIN |
| -------------------------------------- | :----: | :---: | :--------: | :---------: | :---------: | :-----: | :-----: | :-----: | :----: | :-----: | :---------: |
| **Public Catalog Browse / Search**     | ALLOW  | ALLOW |   ALLOW    |    ALLOW    |    ALLOW    |  ALLOW  |  ALLOW  |  ALLOW  | ALLOW  |  ALLOW  |    ALLOW    |
| **Manage Own Cart & Checkout**         | ALLOW* | ALLOW |   ALLOW    |    ALLOW    |    ALLOW    |  DENY   |  DENY   |  DENY   |  DENY  |  DENY   |    DENY     |
| **View Own Customer Orders**           |  DENY  | ALLOW |    DENY    |    DENY     |    DENY     |  VIEW*  |  VIEW*  |  VIEW*  | VIEW*  |  DENY   |    ALLOW    |
| **Apply for Seller Verification**      |  DENY  | ALLOW |    DENY    |    VIEW     |    DENY     |  DENY   |  DENY   |  DENY   |  DENY  |  DENY   |    DENY     |
| **Upload Private KYC Documents**       |  DENY  | DENY  |    DENY    |    ALLOW    |    DENY     |  DENY   |  DENY   |  DENY   |  DENY  |  DENY   |    DENY     |
| **Create / Edit Product Drafts**       |  DENY  | DENY  |   ALLOW    |    DENY     |    DENY     |  DENY   |  DENY   |  DENY   |  DENY  |  DENY   |    DENY     |
| **Submit Listing for Moderation**      |  DENY  | DENY  |   ALLOW    |    DENY     |    DENY     |  DENY   |  DENY   |  DENY   |  DENY  |  DENY   |    DENY     |
| **Publish Approved Listing**           |  DENY  | DENY  |   ALLOW    |    DENY     |    DENY     |  DENY   |  DENY   |  DENY   |  DENY  |  DENY   |    ALLOW    |
| **View Own Seller Sub-Orders**         |  DENY  | DENY  |   ALLOW    |    DENY     |    VIEW     |  VIEW*  |  VIEW*  |  VIEW*  | VIEW*  |  DENY   |    ALLOW    |
| **Fulfill Sub-Order / Book Waybill**   |  DENY  | DENY  |   ALLOW    |    DENY     |    DENY     |  DENY   |  DENY   |  DENY   |  DENY  |  DENY   |    DENY     |
| **View Own Financial Balance**         |  DENY  | DENY  |   ALLOW    |    DENY     |    VIEW     |  DENY   |  DENY   |  VIEW*  |  DENY  |  DENY   |    ALLOW    |
| **Review / Approve Seller KYC**        |  DENY  | DENY  |    DENY    |    DENY     |    DENY     |  DENY   |  DENY   |  DENY   | ALLOW  |  DENY   |    ALLOW    |
| **Moderate / Takedown Listing**        |  DENY  | DENY  |    DENY    |    DENY     |    DENY     |  DENY   |  ALLOW  |  DENY   | ALLOW  |  DENY   |    ALLOW    |
| **Process Standard Refund (<$100)**    |  DENY  | DENY  |    DENY    |    DENY     |    DENY     |  ALLOW  |  ALLOW  |  ALLOW  |  DENY  |  DENY   |    ALLOW    |
| **Execute High-Value Refund (>$500)**  |  DENY  | DENY  |    DENY    |    DENY     |    DENY     |  DENY   |  DUAL*  |  DUAL*  |  DENY  |  DENY   |    DUAL*    |
| **Approve Payout Disbursement Batch**  |  DENY  | DENY  |    DENY    |    DENY     |    DENY     |  DENY   |  DENY   |  ALLOW  |  DENY  |  DENY   |    ALLOW    |
| **Suspend / Reinstate Seller Account** |  DENY  | DENY  |    DENY    |    DENY     |    DENY     |  DENY   |  DENY   |  DENY   | DUAL*  |  DENY   |    DUAL*    |
| **Inspect Immutable Audit Logs**       |  DENY  | DENY  |    DENY    |    DENY     |    DENY     |  DENY   |  DENY   |  VIEW   |  VIEW  |  DENY   |    ALLOW    |
| **Export Aggregate Financial Reports** |  DENY  | DENY  |    DENY    |    DENY     |    DENY     |  DENY   |  DENY   |  ALLOW  |  DENY  |  ALLOW  |    ALLOW    |

_\* Legend:_

- `ALLOW*`: Anonymous cart maintained in ephemeral session; converted on registration/login.
- `VIEW*`: Staff access restricted to explicit ticket or assigned dispute context.
- `DUAL*`: Requires secondary approval from an independent manager before execution.

---

## 3. Object-Level Tenancy Authorization (ABAC) Rules

RBAC determines _what category of actions_ an actor can attempt; ABAC enforces _which specific object instances_ they may touch.

### 3.1 Strict Seller Isolation Invariant

- **Rule:** A seller can ONLY read or mutate resources where:
  $$\text{Resource.sellerId} == \text{CurrentSession.sellerId}$$
- **Scope:** Applies to `sub_orders`, `products`, `product_variants`, `inventory_items`, `shipments`, `seller_balances`, and `pickup_addresses`.
- **Violation Behavior:** If a seller passes a valid ID belonging to another artisan, the API MUST immediately return `HTTP 404 NOT_FOUND` (or `403 FORBIDDEN`), terminate the request, and log a high-priority security event.

### 3.2 Customer Data Protection Invariant

- **Rule:** A customer can ONLY view their own orders, profile addresses, and support tickets where:
  $$\text{Resource.customerId} == \text{CurrentSession.userId}$$
- Direct access to another customer's ID returns `HTTP 404 NOT_FOUND`.

### 3.3 Seller Private Document Protection Invariant

- **Rule:** Identity files (Government Passports, Tax Registration PDFs) stored in `private-documents` bucket have **ZERO public internet access**.
- Only verified `SAFETY` or `SUPER_ADMIN` staff may generate a 5-minute pre-signed download URL, and every generation event must be recorded in the `audit_logs` table.

### 3.4 Direct Balance Mutation Prohibition

- **Rule:** No API endpoint, administrative route, or background worker is authorized to execute `UPDATE seller_balances SET available = ...`.
- All financial balances are strictly computed and projected from immutable entries in `ledger_entries`.

### 3.5 Dual-Approval Security Protocol

- High-risk operations (manual payouts $> \$1,000$, permanent artisan account bans, ledger adjustments) cannot be executed by a single operator.
- The initiating staff member creates a `dual_approval_requests` entry; a second staff member with equal or higher authorization must sign the approval token before execution commits.

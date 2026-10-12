# State Machine Specifications & Transition Rules

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G02 Baseline  
**Rule:** No arbitrary state transitions; all transitions must be strictly validated by domain guards.

---

## 1. Seller Onboarding & Account State Machine

Artisans transition through an auditable identity and compliance verification pipeline.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Register Account
    DRAFT --> UNDER_REVIEW : Submit Verification Docs
    UNDER_REVIEW --> APPROVED : Admin Verify KYC
    UNDER_REVIEW --> REJECTED : Deficient / Fraudulent Docs
    REJECTED --> UNDER_REVIEW : Resubmit Corrected Docs
    APPROVED --> ACTIVE : Activate Shop & Bank Linked
    ACTIVE --> RESTRICTED : Policy Warning / High Disputes
    RESTRICTED --> ACTIVE : Resolution Completed
    ACTIVE --> SUSPENDED : Serious Violation / Fraud
    SUSPENDED --> ACTIVE : Appeal Upheld by Admin
    ACTIVE --> CLOSED : Seller Close Request
    SUSPENDED --> CLOSED : Permanent Takedown
    CLOSED --> [*]
```

### Transition Specifications:

| From State     | To State       | Trigger Event      | Authorized Actor         | Guard Conditions                                                     | Side Effects                                                          |
| -------------- | -------------- | ------------------ | ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `DRAFT`        | `UNDER_REVIEW` | `seller.submitted` | Seller                   | Tax ID, legal proof, and bank details supplied.                      | Ingest private docs to private S3 bucket; notify compliance queue.    |
| `UNDER_REVIEW` | `APPROVED`     | `seller.approved`  | Compliance Staff / Admin | Background check passed, tax ID verified against government records. | Create public `Shop` record; dispatch welcome email.                  |
| `UNDER_REVIEW` | `REJECTED`     | `seller.rejected`  | Compliance Staff / Admin | Specific rejection reason code provided.                             | Notify seller with remediation checklist; permit resubmission.        |
| `APPROVED`     | `ACTIVE`       | `shop.activated`   | Seller                   | Pickup address configured, shop profile complete.                    | Enable product draft submission and publishing.                       |
| `ACTIVE`       | `SUSPENDED`    | `seller.suspended` | Admin / Safety System    | Fraud threshold breached, dual-approval signed.                      | Delist all active products; freeze available payouts; notify artisan. |

---

## 2. Product Listing & Moderation State Machine

Handcrafted listings require quality and authenticity checks before consumer discovery.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Create Listing
    DRAFT --> PENDING_REVIEW : Submit for Moderation
    PENDING_REVIEW --> APPROVED : Staff Approve
    PENDING_REVIEW --> REJECTED : Policy / Quality Violation
    REJECTED --> DRAFT : Seller Revise Listing
    APPROVED --> PUBLISHED : Seller Publish / Auto-Publish
    PUBLISHED --> UNPUBLISHED : Seller Pause / Vacation Mode
    UNPUBLISHED --> PUBLISHED : Seller Resume
    PUBLISHED --> SUSPENDED : Admin Takedown / Copyright
    SUSPENDED --> PENDING_REVIEW : Dispute Resolved
    PUBLISHED --> ARCHIVED : One-of-a-Kind Sold / Deleted
    ARCHIVED --> [*]
```

### Transition Specifications:

- **`DRAFT` to `PENDING_REVIEW`:** Guard requires minimum 3 photos, valid category, title, description, material attributes, base price $> 0$, and inventory tracking configuration.
- **`PENDING_REVIEW` to `APPROVED`:** Guard checks for prohibited mass-market reselling items, copyright infringements, or offensive material.
- **`APPROVED` to `PUBLISHED`:** Enables listing in search index and public storefront. If inventory is 0 and product is `READY_TO_SHIP`, auto-renders as "Out of Stock".
- **`PUBLISHED` to `ARCHIVED`:** Triggers when a `ONE_OF_A_KIND` product is purchased and payment captured. Prevents duplicate purchases permanently.

---

## 3. Customer Order & Multi-Vendor Sub-Order State Machine

A single `CustomerOrder` contains one or more independent artisan `SubOrder` records.

### 3.1 Parent Customer Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PENDING_PAYMENT : Checkout Initialized
    PENDING_PAYMENT --> PAID : Webhook Payment Succeeded
    PENDING_PAYMENT --> EXPIRED : Checkout TTL Exceeded (15m)
    PENDING_PAYMENT --> FAILED : Payment Gateway Declined
    PAID --> PROCESSING : Sub-Orders Dispatched to Sellers
    PROCESSING --> PARTIALLY_SHIPPED : First Sub-Order Shipped
    PARTIALLY_SHIPPED --> SHIPPED : All Sub-Orders Shipped
    SHIPPED --> DELIVERED : All Sub-Orders Delivered
    DELIVERED --> COMPLETED : Return Windows Expired
    PAID --> CANCELLED : Customer / Admin Cancel Before Production
    PAID --> REFUNDED : All Sub-Orders Refunded
```

### 3.2 Seller Sub-Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> CONFIRMED : Parent Order Paid
    CONFIRMED --> IN_PRODUCTION : Artisan Commences Crafting
    CONFIRMED --> READY_FOR_PICKUP : Ready-to-Ship Packed
    IN_PRODUCTION --> READY_FOR_PICKUP : Bespoke Crafting Finished
    READY_FOR_PICKUP --> SHIPPED : Courier Scanned at Origin
    SHIPPED --> DELIVERED : Courier Scanned at Destination
    DELIVERED --> COMPLETED : 7-Day Return Window Elapsed
    CONFIRMED --> CANCELLED : Artisan Out-of-Stock / Unfulfillable
    DELIVERED --> RETURN_REQUESTED : Customer Files Return
    RETURN_REQUESTED --> RETURNED : Return Received & Accepted
```

### Sub-Order State Rules:

1. **`CONFIRMED` to `IN_PRODUCTION`:** Applies to `MADE_TO_ORDER` and `PERSONALIZED` goods. Once in production, customer automatic self-service cancellation is disabled.
2. **`READY_FOR_PICKUP` to `SHIPPED`:** Transition is triggered automatically upon courier pickup scan webhook (`PICKED_UP`). Sellers cannot manually mark an order `SHIPPED` without generating an authorized tracking waybill.
3. **`DELIVERED` to `COMPLETED`:** Automated job transitions status after the dispute/return window (7 calendar days post-delivery) expires. This unlocks the funds in the financial ledger from `pending_escrow` to `available_payout`.

---

## 4. Payment Attempt & Webhook Processing State Machine

```mermaid
stateDiagram-v2
    [*] --> INITIATED : Create Payment Intent
    INITIATED --> PROCESSING : Customer Submits Payment
    PROCESSING --> SUCCEEDED : Signed Provider Webhook (charge.success)
    PROCESSING --> FAILED : Gateway Decline / Bank Failure
    INITIATED --> EXPIRED : Gateway Session Timeout
    SUCCEEDED --> REFUNDED : Full Refund Processed
    SUCCEEDED --> PARTIALLY_REFUNDED : Sub-Order Refunded
```

### Payment Invariants:

- **Zero Client Trust:** A client redirect to a "success" page NEVER marks a payment `SUCCEEDED`. Only a cryptographically verified webhook or verified server-to-server gateway lookup can transition payment to `SUCCEEDED`.
- **Idempotency Guard:** If a webhook with `event_id` is received multiple times, the state machine ignores duplicates and returns HTTP 200 OK without re-executing ledger entries.

---

## 5. Shipment & Logistics State Machine

```mermaid
stateDiagram-v2
    [*] --> LABEL_CREATED : Artisan Generates Waybill
    LABEL_CREATED --> PICKUP_SCHEDULED : Manifest Manifested
    PICKUP_SCHEDULED --> IN_TRANSIT : Physical Pickup Scan
    IN_TRANSIT --> OUT_FOR_DELIVERY : Destination Hub Out Scan
    OUT_FOR_DELIVERY --> DELIVERED : Final Delivery OTP / Signature
    OUT_FOR_DELIVERY --> DELIVERY_FAILED : Customer Unavailable / Address Deficient
    DELIVERY_FAILED --> OUT_FOR_DELIVERY : Reattempt Scheduled (Max 3)
    DELIVERY_FAILED --> RTO_INITIATED : Reattempts Exhausted
    RTO_INITIATED --> RTO_DELIVERED : Returned to Artisan Studio
```

---

## 6. Financial Ledger & Seller Payout State Machine

```mermaid
stateDiagram-v2
    [*] --> ACCRUED_ESCROW : Payment Captured (Sub-Order Paid)
    ACCRUED_ESCROW --> ELIGIBLE_PAYOUT : Sub-Order Completed (Return Window Closed)
    ACCRUED_ESCROW --> REVERSED_REFUND : Order Cancelled / Return Approved
    ELIGIBLE_PAYOUT --> BATCHED : Added to Weekly Payout Batch
    BATCHED --> PROCESSING : Bank Disbursement Initiated
    PROCESSING --> SETTLED : Bank Confirmation (UTR Received)
    PROCESSING --> FAILED : Bank Account Invalid / Transfer Failed
    FAILED --> ELIGIBLE_PAYOUT : Account Corrected by Artisan
```

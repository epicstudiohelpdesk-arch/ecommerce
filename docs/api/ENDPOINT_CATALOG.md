# Comprehensive REST Endpoint Catalog

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G02 Baseline  
**Base Path:** `/api/v1`  
**Specification Requirement:** All endpoints documented with 16 architectural dimensions.

---

## 1. Authentication & Identity Endpoints

### 1.1 Register Customer Account

- **Method & Path:** `POST /api/v1/auth/register`
- **Purpose:** Create a new customer identity account.
- **Authentication:** None (Public).
- **Required Permissions:** None.
- **Parameters:** None.
- **Request Body Schema:**
  ```json
  {
    "email": "customer@example.com",
    "password": "StrongPassword123!",
    "fullName": "Jane Doe",
    "phone": "+15551234567"
  }
  ```
- **Response Schema:** `ApiResponse<{ userId: string, email: string, requiresEmailVerification: boolean }>`
- **Validation Constraints:** Email valid format; password min 12 chars, upper, lower, number, special char.
- **Error Codes:** `VALIDATION_FAILED`, `EMAIL_ALREADY_EXISTS`.
- **Idempotency Requirements:** None.
- **Rate-Limit:** 5 req/min per IP.
- **Pagination:** N/A.
- **Audit Requirements:** Log registration attempt with client IP and user agent.
- **Side Effects:** Insert `users` record with role `CUSTOMER`; emit outbox verification event.
- **Domain Events:** `identity.user_registered`
- **Required Tests:** Test duplicate email rejection; test password complexity rejection; test happy path.

### 1.2 Login with Credentials

- **Method & Path:** `POST /api/v1/auth/login`
- **Purpose:** Authenticate user credentials, issue secure HTTP-only session cookie and access token.
- **Authentication:** None (Public).
- **Required Permissions:** None.
- **Parameters:** None.
- **Request Body:** `{ "email": "string", "password": "string" }`
- **Response Schema:** `ApiResponse<{ user: { id: string, email: string, roles: string[] }, accessToken: string }>` + `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Lax`
- **Validation Constraints:** Email trim/lowercase; password non-empty string.
- **Error Codes:** `UNAUTHENTICATED`, `ACCOUNT_SUSPENDED`, `MFA_REQUIRED`.
- **Idempotency Requirements:** None.
- **Rate-Limit:** 5 attempts/15 min per IP and email.
- **Pagination:** N/A.
- **Audit Requirements:** Log failed login attempts with IP; log successful session establishment.
- **Side Effects:** Create `user_sessions` record; rotate refresh token family.
- **Domain Events:** `identity.user_logged_in`
- **Required Tests:** Test brute-force rate limit lockout; test invalid password; test suspended account rejection.

### 1.3 Terminate Session (Logout)

- **Method & Path:** `POST /api/v1/auth/logout`
- **Purpose:** Revoke active refresh token family and clear session cookies.
- **Authentication:** Authenticated.
- **Required Permissions:** Authenticated user.
- **Parameters:** None.
- **Request Body:** Empty.
- **Response Schema:** `ApiResponse<{ message: string }>` + Clear session cookies.
- **Validation Constraints:** None.
- **Error Codes:** `UNAUTHENTICATED`.
- **Idempotency Requirements:** Idempotent.
- **Rate-Limit:** Standard authenticated.
- **Pagination:** N/A.
- **Audit Requirements:** Log session termination.
- **Side Effects:** Mark `user_sessions` record as `REVOKED`.
- **Domain Events:** `identity.session_revoked`
- **Required Tests:** Test revoked session cannot refresh tokens.

---

## 2. Seller Onboarding & Shop Endpoints

### 2.1 Submit Seller Onboarding Application

- **Method & Path:** `POST /api/v1/seller/onboarding/apply`
- **Purpose:** Register legal artisan business identity, upload tax details, and request verification.
- **Authentication:** Authenticated (`CUSTOMER` role).
- **Required Permissions:** `seller:apply`.
- **Parameters:** None.
- **Request Body:**
  ```json
  {
    "legalName": "Artisan Craft Studio LLC",
    "businessType": "SOLE_PROPRIETORSHIP",
    "taxId": "GSTIN27AABCU9603R1ZM",
    "shopName": "Cedar & Clay Crafts",
    "shopSlug": "cedar-and-clay",
    "craftDescription": "Hand-turned wooden bowls and functional wheel-thrown pottery.",
    "pickupAddress": {
      "streetAddress": "123 Timber Lane",
      "city": "Portland",
      "state": "OR",
      "postalCode": "97201",
      "country": "USA"
    }
  }
  ```
- **Response Schema:** `ApiResponse<{ sellerId: string, status: "UNDER_REVIEW", submittedAt: string }>`
- **Validation Constraints:** Slug URL-safe regex; tax ID format validated against country rules; pickup postal code validated.
- **Error Codes:** `VALIDATION_FAILED`, `SLUG_ALREADY_TAKEN`, `SELLER_ALREADY_APPLIED`.
- **Idempotency Requirements:** Header `Idempotency-Key` required.
- **Rate-Limit:** 3 req/hour per user.
- **Pagination:** N/A.
- **Audit Requirements:** Record seller application creation in audit trail.
- **Side Effects:** Insert `seller_profiles`, `shops`, and `pickup_addresses` within atomic transaction; transition state to `UNDER_REVIEW`.
- **Domain Events:** `seller.application_submitted`
- **Required Tests:** Test duplicate slug collision rejection; test atomic transaction rollback on pickup address failure.

### 2.2 Upload Private KYC Verification Document

- **Method & Path:** `POST /api/v1/seller/onboarding/documents`
- **Purpose:** Generate a secure pre-signed S3 upload URL for private seller identity verification documents.
- **Authentication:** Authenticated (`SELLER` applicant).
- **Required Permissions:** `seller:manage_own_docs`.
- **Parameters:** None.
- **Request Body:**
  ```json
  {
    "documentType": "GOVERNMENT_ID",
    "fileName": "artisan-passport.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 2450000
  }
  ```
- **Response Schema:** `ApiResponse<{ documentId: string, presignedUploadUrl: string, expiresInSeconds: 300 }>`
- **Validation Constraints:** `mimeType` in `['application/pdf', 'image/jpeg', 'image/png']`; `fileSizeBytes` $\le 10485760$ (10MB).
- **Error Codes:** `VALIDATION_FAILED`, `DOCUMENT_INVALID`.
- **Idempotency Requirements:** None.
- **Rate-Limit:** 10 req/hour per seller.
- **Pagination:** N/A.
- **Audit Requirements:** Log document upload ticket generation with document type (no file contents logged).
- **Side Effects:** Insert pending `seller_documents` metadata record pointing to private S3 bucket.
- **Domain Events:** `seller.document_uploaded`
- **Required Tests:** Test oversized file rejection; test forbidden file types (e.g. .exe).

### 2.3 Retrieve Seller Shop Profile

- **Method & Path:** `GET /api/v1/seller/shop`
- **Purpose:** Get authenticated seller's shop settings, verification status, and fulfillment metrics.
- **Authentication:** Authenticated (`SELLER` role).
- **Required Permissions:** `seller:read_own_profile`.
- **Parameters:** None.
- **Request Body:** None.
- **Response Schema:** `ApiResponse<SellerShopDetailsDto>`
- **Validation Constraints:** None.
- **Error Codes:** `UNAUTHENTICATED`, `SELLER_NOT_FOUND`.
- **Idempotency Requirements:** Read-only.
- **Rate-Limit:** 60 req/min.
- **Pagination:** N/A.
- **Audit Requirements:** None.
- **Side Effects:** None.
- **Domain Events:** None.
- **Required Tests:** Test tenant isolation: seller A cannot retrieve seller B's shop data.

---

## 3. Catalog & Product Endpoints

### 3.1 Public Product Search & Discovery

- **Method & Path:** `GET /api/v1/catalog/products`
- **Purpose:** Browse and filter published handcrafted products across categories, craft types, and price bands.
- **Authentication:** None (Public).
- **Required Permissions:** None.
- **Parameters (Query):**
  - `categorySlug` (optional string)
  - `productType` (optional enum: `READY_TO_SHIP`, `MADE_TO_ORDER`, `ONE_OF_A_KIND`, `PERSONALIZED`)
  - `minPriceMinor`, `maxPriceMinor` (optional integers)
  - `page` (default: 1), `limit` (default: 20, max: 100)
- **Request Body:** None.
- **Response Schema:** `PaginatedResponse<ProductSummaryDto>`
- **Validation Constraints:** Positive price bounds; `limit` $\le 100$.
- **Error Codes:** `VALIDATION_FAILED`.
- **Idempotency Requirements:** Read-only.
- **Rate-Limit:** 120 req/min per IP.
- **Pagination:** Standard paginated envelope.
- **Audit Requirements:** None.
- **Side Effects:** None.
- **Domain Events:** None.
- **Required Tests:** Test filter combinations; test unpublished products excluded from public search.

### 3.2 Retrieve Product Details

- **Method & Path:** `GET /api/v1/catalog/products/:slug`
- **Purpose:** Retrieve full details for a product listing, including artisan shop story, variants, materials, dimensions, and lead times.
- **Authentication:** None (Public).
- **Required Permissions:** None.
- **Parameters (Path):** `slug` (string).
- **Request Body:** None.
- **Response Schema:** `ApiResponse<ProductDetailDto>`
- **Validation Constraints:** Valid slug string.
- **Error Codes:** `PRODUCT_NOT_FOUND`.
- **Idempotency Requirements:** Read-only.
- **Rate-Limit:** 120 req/min per IP.
- **Pagination:** N/A.
- **Audit Requirements:** None.
- **Side Effects:** Increment non-blocking view counter via background worker.
- **Domain Events:** None.
- **Required Tests:** Test draft/suspended products return 404 to unauthenticated visitors.

### 3.3 Create Product Draft

- **Method & Path:** `POST /api/v1/seller/products`
- **Purpose:** Create an artisan product draft with variants, handcrafted attributes, and media attachments.
- **Authentication:** Authenticated (`SELLER` role with `ACTIVE` shop).
- **Required Permissions:** `seller:create_product`.
- **Parameters:** None.
- **Request Body:**
  ```json
  {
    "title": "Hand-Carved Walnut Salad Bowl",
    "description": "Turned from locally reclaimed walnut wood, finished with organic beeswax.",
    "categoryId": "cat_pottery_wood_001",
    "productType": "ONE_OF_A_KIND",
    "basePriceMinor": 12500,
    "currency": "USD",
    "productionLeadDays": 0,
    "materials": ["Black Walnut", "Organic Beeswax"],
    "dimensionsMm": { "length": 250, "width": 250, "height": 100 },
    "weightGrams": 850,
    "isFragile": true,
    "variants": [
      {
        "sku": "WSB-001",
        "name": "Single Edition 10-inch",
        "priceMinor": 12500,
        "initialStock": 1
      }
    ]
  }
  ```
- **Response Schema:** `ApiResponse<{ productId: string, status: "DRAFT" }>`
- **Validation Constraints:** Base price $> 0$; title min 5 max 150 chars; stock $\ge 1$ for ready-to-ship.
- **Error Codes:** `SELLER_NOT_VERIFIED`, `VALIDATION_FAILED`, `CATEGORY_NOT_FOUND`.
- **Idempotency Requirements:** Header `Idempotency-Key` required.
- **Rate-Limit:** 30 req/min.
- **Pagination:** N/A.
- **Audit Requirements:** Log product draft creation.
- **Side Effects:** Insert `products`, `product_variants`, and `inventory_items` within transaction.
- **Domain Events:** `catalog.product_draft_created`
- **Required Tests:** Test OOAK enforces initial stock = 1; test unverified seller rejected.

### 3.4 Submit Listing for Moderation

- **Method & Path:** `POST /api/v1/seller/products/:productId/submit-review`
- **Purpose:** Submit completed product draft to platform moderation queue.
- **Authentication:** Authenticated (`SELLER` owner).
- **Required Permissions:** `seller:manage_own_products`.
- **Parameters (Path):** `productId` (UUID).
- **Request Body:** None.
- **Response Schema:** `ApiResponse<{ productId: string, status: "PENDING_REVIEW" }>`
- **Validation Constraints:** Product must have minimum 3 verified media assets.
- **Error Codes:** `PRODUCT_NOT_FOUND`, `UNAUTHORIZED`, `INVALID_ORDER_STATE`, `VALIDATION_FAILED`.
- **Idempotency Requirements:** Idempotent.
- **Rate-Limit:** 20 req/min.
- **Pagination:** N/A.
- **Audit Requirements:** Log submission for moderation.
- **Side Effects:** Transition status from `DRAFT` to `PENDING_REVIEW`.
- **Domain Events:** `catalog.product_submitted_for_review`
- **Required Tests:** Test cannot submit other seller's product (tenant isolation); test cannot submit without photos.

---

## 4. Cart & Checkout Endpoints

### 4.1 Retrieve or Sync Active Cart

- **Method & Path:** `GET /api/v1/cart`
- **Purpose:** Retrieve the customer's cart, grouped by independent artisan shop, with real-time stock and price checks.
- **Authentication:** Optional (Customer or Guest Session).
- **Required Permissions:** None.
- **Parameters:** None.
- **Request Body:** None.
- **Response Schema:** `ApiResponse<CartViewDto>`
- **Validation Constraints:** None.
- **Error Codes:** None.
- **Idempotency Requirements:** Read-only.
- **Rate-Limit:** 60 req/min.
- **Pagination:** N/A.
- **Audit Requirements:** None.
- **Side Effects:** Remove or flag expired/out-of-stock items.
- **Domain Events:** None.
- **Required Tests:** Test multi-seller cart partitions items by `shopId`; test price recalculations.

### 4.2 Add Item to Cart

- **Method & Path:** `POST /api/v1/cart/items`
- **Purpose:** Add product variant to cart with optional personalization instructions.
- **Authentication:** Optional.
- **Required Permissions:** None.
- **Request Body:**
  ```json
  {
    "variantId": "var_987e6543-e21b-12d3-a456-426614174000",
    "quantity": 1,
    "customizationPrompt": "Engrave initials 'J.D.' on bottom."
  }
  ```
- **Response Schema:** `ApiResponse<CartViewDto>`
- **Validation Constraints:** Quantity $\ge 1$; customization length $\le 500$ chars; variant must be published.
- **Error Codes:** `PRODUCT_NOT_FOUND`, `INVENTORY_INSUFFICIENT`, `SHOP_INACTIVE`.
- **Idempotency Requirements:** None.
- **Rate-Limit:** 30 req/min.
- **Pagination:** N/A.
- **Audit Requirements:** None.
- **Side Effects:** Upsert `cart_items` record.
- **Domain Events:** None.
- **Required Tests:** Test stock check blocks addition if requested quantity exceeds stock.

### 4.3 Initialize Checkout Session (Atomic Stock Reservation)

- **Method & Path:** `POST /api/v1/checkout/session`
- **Purpose:** Lock inventory items atomically with 15-minute TTL, compute final multi-seller shipping and taxes, and generate payment intent.
- **Authentication:** Authenticated (`CUSTOMER`).
- **Required Permissions:** `customer:checkout`.
- **Parameters:** None.
- **Request Body:**
  ```json
  {
    "shippingAddressId": "addr_123e4567-e89b",
    "couponCode": "SUMMER_ART_10"
  }
  ```
- **Response Schema:**
  ```json
  {
    "success": true,
    "data": {
      "checkoutSessionId": "cs_01HXYZ9876CHECKOUT",
      "pricingSnapshotId": "ps_01HXYZ9876SNAPSHOT",
      "reservationExpiresAt": "2026-10-12T08:45:00.000Z",
      "breakdown": {
        "itemsSubtotalMinor": 17000,
        "shippingTotalMinor": 1200,
        "discountMinor": 1700,
        "taxMinor": 1320,
        "totalPayableMinor": 17820,
        "currency": "USD",
        "sellerFulfilmentGroups": [
          {
            "sellerId": "sel_01",
            "shopName": "Cedar & Clay",
            "subtotalMinor": 12500,
            "shippingMinor": 600
          },
          {
            "sellerId": "sel_02",
            "shopName": "Silver & Stone",
            "subtotalMinor": 4500,
            "shippingMinor": 600
          }
        ]
      },
      "paymentClientSecret": "pi_stripe_test_secret_abc123"
    }
  }
  ```
- **Validation Constraints:** Shipping address must be valid and serviceable.
- **Error Codes:** `CART_EMPTY`, `INVENTORY_INSUFFICIENT`, `PRICE_STALE`, `RESERVATION_EXPIRED`.
- **Idempotency Requirements:** Header `Idempotency-Key` required.
- **Rate-Limit:** 5 req/min per customer.
- **Pagination:** N/A.
- **Audit Requirements:** Log checkout session creation.
- **Side Effects:** Atomically insert `inventory_reservations` using `SELECT FOR UPDATE`; persist `pricing_snapshots`; schedule BullMQ reservation expiry job.
- **Domain Events:** `inventory.stock_reserved`, `checkout.session_created`
- **Required Tests:** Concurrent checkout stress test: two buyers checking out same OOAK item (stock=1); verify exactly one succeeds and second receives `INVENTORY_INSUFFICIENT`.

---

## 5. Orders & Fulfillment Endpoints

### 5.1 Retrieve Customer Orders

- **Method & Path:** `GET /api/v1/orders`
- **Purpose:** Customer views their historical purchases with per-seller tracking summaries.
- **Authentication:** Authenticated (`CUSTOMER`).
- **Required Permissions:** `customer:read_own_orders`.
- **Parameters (Query):** `page`, `limit`, `status`.
- **Response Schema:** `PaginatedResponse<CustomerOrderSummaryDto>`
- **Error Codes:** `UNAUTHENTICATED`.
- **Idempotency Requirements:** Read-only.
- **Rate-Limit:** 30 req/min.
- **Pagination:** Standard paginated envelope.
- **Audit Requirements:** None.
- **Required Tests:** Test customer cannot view other customers' orders.

### 5.2 Retrieve Seller Sub-Orders

- **Method & Path:** `GET /api/v1/seller/orders`
- **Purpose:** Artisan retrieves fulfillment orders assigned specifically to their shop.
- **Authentication:** Authenticated (`SELLER`).
- **Required Permissions:** `seller:read_own_sub_orders`.
- **Parameters (Query):** `page`, `limit`, `status` (`CONFIRMED`, `IN_PRODUCTION`, `READY_FOR_PICKUP`, `SHIPPED`, `DELIVERED`).
- **Response Schema:** `PaginatedResponse<SellerSubOrderDto>`
- **Error Codes:** `UNAUTHENTICATED`, `SELLER_NOT_VERIFIED`.
- **Idempotency Requirements:** Read-only.
- **Rate-Limit:** 60 req/min.
- **Pagination:** Standard paginated envelope.
- **Audit Requirements:** None.
- **Required Tests:** Strict tenancy test: Seller A only receives sub-orders where `seller_id = seller_a.id`.

### 5.3 Artisan Update Sub-Order Fulfillment State

- **Method & Path:** `POST /api/v1/seller/orders/:subOrderId/transition`
- **Purpose:** Artisan advances made-to-order item to `IN_PRODUCTION` or `READY_FOR_PICKUP`.
- **Authentication:** Authenticated (`SELLER` owner).
- **Required Permissions:** `seller:manage_own_sub_orders`.
- **Parameters (Path):** `subOrderId` (UUID).
- **Request Body:** `{ "targetStatus": "IN_PRODUCTION", "notes": "Wood selection finalized; turning started." }`
- **Response Schema:** `ApiResponse<{ subOrderId: string, status: string, updatedAt: string }>`
- **Validation Constraints:** `targetStatus` must be a valid next step in state machine.
- **Error Codes:** `INVALID_ORDER_STATE`, `ORDER_NOT_FOUND`, `UNAUTHORIZED`.
- **Idempotency Requirements:** Header `Idempotency-Key` required.
- **Rate-Limit:** 30 req/min.
- **Audit Requirements:** Log order transition with artisan ID and notes.
- **Side Effects:** Insert `order_timeline_events`; update `sub_orders.status`.
- **Domain Events:** `order.sub_order_in_production`
- **Required Tests:** Test invalid state skip (e.g. `CONFIRMED` directly to `DELIVERED` rejected).

---

## 6. Payments & Financial Endpoints

### 6.1 Payment Gateway Webhook Ingestion

- **Method & Path:** `POST /api/v1/payments/webhooks/:provider`
- **Purpose:** Ingest signed webhook events from payment gateway (Stripe, Razorpay) to confirm payments or chargebacks.
- **Authentication:** Signature Verification (HMAC SHA-256 header).
- **Required Permissions:** Verified provider signature.
- **Parameters (Path):** `provider` (`stripe`, `razorpay`).
- **Request Body:** Raw webhook JSON payload.
- **Response Schema:** `{ "received": true }`
- **Validation Constraints:** Webhook signature matches computed HMAC using provider signing secret.
- **Error Codes:** `WEBHOOK_SIGNATURE_INVALID`, `DUPLICATE_WEBHOOK_EVENT`.
- **Idempotency Requirements:** Evaluates `payment_webhook_events.event_id`; duplicate calls return HTTP 200 without re-executing.
- **Rate-Limit:** 300 req/min.
- **Audit Requirements:** Log webhook receipt, event type, and outcome.
- **Side Effects:**
  - Atomically update `payment_attempts.status = 'SUCCEEDED'`.
  - Split customer order into artisan `SubOrder` records.
  - Commit `inventory_reservations` to permanent inventory decrements.
  - Insert double-entry `ledger_entries` for escrow and commission.
  - Emit `payment.intent_succeeded`.
- **Domain Events:** `payment.intent_succeeded`, `order.customer_order_placed`
- **Required Tests:** Test duplicate webhook delivery does not create duplicate ledger entries or double orders.

### 6.2 Retrieve Seller Earnings & Balance Statement

- **Method & Path:** `GET /api/v1/seller/finance/balance`
- **Purpose:** Artisan inspects cleared available balance, funds in escrow hold, and upcoming payouts.
- **Authentication:** Authenticated (`SELLER`).
- **Required Permissions:** `seller:view_finances`.
- **Response Schema:**
  ```json
  {
    "success": true,
    "data": {
      "currency": "USD",
      "availablePayoutMinor": 45200,
      "pendingEscrowMinor": 18500,
      "heldDisputeMinor": 0,
      "lifetimeEarningsMinor": 345000,
      "nextScheduledPayoutDate": "2026-10-16"
    }
  }
  ```
- **Error Codes:** `UNAUTHENTICATED`, `SELLER_NOT_VERIFIED`.
- **Idempotency Requirements:** Read-only.
- **Rate-Limit:** 30 req/min.
- **Required Tests:** Test balance amounts match sum of ledger journal entries.

---

## 7. Shipping & Logistics Endpoints

### 7.1 Generate Shipping Label & Waybill

- **Method & Path:** `POST /api/v1/seller/orders/:subOrderId/shipment/book`
- **Purpose:** Artisan books courier pickup, generates tracking waybill (AWB), and retrieves printable PDF label.
- **Authentication:** Authenticated (`SELLER` owner).
- **Required Permissions:** `seller:manage_own_shipping`.
- **Parameters (Path):** `subOrderId` (UUID).
- **Request Body:**
  ```json
  {
    "packageWeightGrams": 950,
    "packageDimensionsMm": { "length": 260, "width": 260, "height": 120 },
    "pickupDate": "2026-10-13"
  }
  ```
- **Response Schema:**
  ```json
  {
    "success": true,
    "data": {
      "shipmentId": "ship_01HXYZ9876",
      "carrier": "Delhivery",
      "waybillNumber": "AWB-9876543210",
      "shippingLabelPdfUrl": "https://cdn.artisanmarketplace.com/labels/ship_01HXYZ9876.pdf",
      "pickupScheduledDate": "2026-10-13"
    }
  }
  ```
- **Validation Constraints:** Sub-order must be in `READY_FOR_PICKUP` or `CONFIRMED`; package weight and dimensions must be positive integers.
- **Error Codes:** `ORDER_NOT_FOUND`, `INVALID_ORDER_STATE`, `CARRIER_API_ERROR`, `INVALID_PICKUP_ADDRESS`.
- **Idempotency Requirements:** Header `Idempotency-Key` required.
- **Rate-Limit:** 20 req/min.
- **Audit Requirements:** Log shipment creation with waybill number.
- **Side Effects:** Insert `shipments` record; update `sub_orders.status = 'READY_FOR_PICKUP'`.
- **Domain Events:** `shipping.label_created`
- **Required Tests:** Test courier API failure handles gracefully without corrupting sub-order state.

### 7.2 Courier Milestone Webhook Ingestion

- **Method & Path:** `POST /api/v1/shipping/webhooks/:carrier`
- **Purpose:** Ingest courier tracking checkpoint pushes to synchronize order fulfillment milestones.
- **Authentication:** Signed courier webhook token.
- **Parameters (Path):** `carrier` (carrier identifier).
- **Request Body:** Courier status push payload.
- **Response Schema:** `{ "received": true }`
- **Side Effects:** Insert `shipment_milestones`; transition `sub_orders` and `shipments` status (`IN_TRANSIT`, `DELIVERED`).
- **Domain Events:** `shipping.milestone_updated`, `shipping.delivered`
- **Required Tests:** Test delivery scan triggers 7-day return escrow timer.

---

## 8. Administration & Control Center Endpoints

### 8.1 Review Seller KYC Verification

- **Method & Path:** `POST /api/v1/admin/sellers/:sellerId/review`
- **Purpose:** Platform compliance officer reviews artisan identity documents and approves/rejects shop.
- **Authentication:** Authenticated (`ADMIN` or `STAFF_COMPLIANCE`).
- **Required Permissions:** `admin:verify_sellers`.
- **Parameters (Path):** `sellerId` (UUID).
- **Request Body:** `{ "decision": "APPROVED", "reasonNotes": "Government photo ID and tax registration verified." }`
- **Response Schema:** `ApiResponse<{ sellerId: string, status: "APPROVED", reviewedAt: string }>`
- **Validation Constraints:** `decision` in `['APPROVED', 'REJECTED']`; notes required if rejected.
- **Error Codes:** `UNAUTHORIZED`, `SELLER_NOT_FOUND`, `INVALID_ORDER_STATE`.
- **Idempotency Requirements:** Header `Idempotency-Key` required.
- **Audit Requirements:** Mandatory immutable audit log entry capturing reviewer ID, decision, and IP address.
- **Side Effects:** Transition `seller_profiles.status = 'APPROVED'`; emit outbox notification.
- **Domain Events:** `seller.approved` or `seller.rejected`
- **Required Tests:** Customer or seller cannot access endpoint (returns 403 Forbidden).

### 8.2 Moderate Product Listing

- **Method & Path:** `POST /api/v1/admin/catalog/products/:productId/moderate`
- **Purpose:** Staff approves, rejects, or takes down a handcrafted product listing.
- **Authentication:** Authenticated (`ADMIN` or `STAFF_MODERATOR`).
- **Required Permissions:** `admin:moderate_catalog`.
- **Parameters (Path):** `productId` (UUID).
- **Request Body:** `{ "decision": "APPROVED", "reasonCode": "AUTHENTIC_HANDMADE_VERIFIED", "notes": "Approved." }`
- **Response Schema:** `ApiResponse<{ productId: string, status: "APPROVED" }>`
- **Error Codes:** `UNAUTHORIZED`, `PRODUCT_NOT_FOUND`.
- **Audit Requirements:** Record moderation action in `moderation_records` and `audit_logs`.
- **Side Effects:** Transition product moderation state; index or delist from search.
- **Domain Events:** `catalog.product_approved` or `catalog.product_rejected`
- **Required Tests:** Test takedown removes item from public catalog immediately.

### 8.3 Execute High-Value Refund (Dual Approval)

- **Method & Path:** `POST /api/v1/admin/finance/refunds/:subOrderId/execute`
- **Purpose:** Finance staff executes an exceptional customer refund over $\$500$ requiring secondary manager approval.
- **Authentication:** Authenticated (`FINANCE_OPERATOR`).
- **Required Permissions:** `finance:execute_refund`.
- **Parameters (Path):** `subOrderId` (UUID).
- **Request Body:**
  ```json
  {
    "amountMinor": 65000,
    "reason": "Artisan damaged fragile ceramic sculpture during packing.",
    "restockInventory": false,
    "secondaryApprovalToken": "dual_appr_token_01HXYZ9876"
  }
  ```
- **Response Schema:** `ApiResponse<{ refundId: string, status: "PROCESSED", amountMinor: 65000 }>`
- **Validation Constraints:** Secondary approval token must be signed by an independent manager.
- **Error Codes:** `UNAUTHORIZED`, `DUAL_APPROVAL_REQUIRED`, `UNBALANCED_LEDGER_TRANSACTION`.
- **Audit Requirements:** High-severity audit log entry recording both requester and approver.
- **Side Effects:** Gateway refund API dispatch; post reverse ledger entries; adjust seller escrow.
- **Domain Events:** `refund.completed`
- **Required Tests:** Test rejection when secondary approval is missing for high-value refunds.

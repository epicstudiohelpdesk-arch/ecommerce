# GATE G11 COMPLETION REPORT

## Courier Integration, Shipping Operations & Order Fulfilment

**Project:** Handcrafted Multi-Vendor Marketplace  
**Gate:** G11  
**Gate Status:** **PASS (Pending Human Review)**  
**Prerequisites:** G00 through G10 (including G07A) APPROVED & VERIFIED  
**Next Gate:** G12 (Admin & Agency Control Center, Platform Operations & Governance)

---

## 1. Executive Summary

Gate G11 establishes the production-oriented **Courier Integration, Shipping Operations & Fulfilment Engine** for the handcrafted marketplace. The engine bridges product orders placed by customers and crafted by independent artisans with real logistics networks across India.

In strict adherence to the project constitution, seller multi-tenancy rules, data isolation boundaries, and the G07A Master Design System:

1. **Provider Abstraction (`IShippingProvider`):** Implements an isolated carrier adapter pattern. Logistics operations (serviceability checks, B2C waybill manifest booking, shipping label generation, pickup scheduling, cancellation, and tracking event normalization) are decoupled from marketplace domain logic.
2. **India-First Courier Integration (`DelhiveryProvider` & `MockCourierProvider`):**
   - **Delhivery Express B2C:** Integrated with Delhivery's live surface/express logistics API format (6-digit PIN code serviceability check, B2C CMU manifest booking, waybill assignment, pickup slot scheduling, 4x6" thermal printable labels, and cancellation).
   - **Mock Courier:** Hermetic, reproducible courier provider for local offline development and CI integration tests with deterministic AWB generation and HMAC-SHA256 signature verification.
3. **Server-Authoritative State Synchronization:**
   - Sub-orders in `READY_FOR_PICKUP` transition to `SHIPPED` upon verified courier pickup scan (`IN_TRANSIT`).
   - Sibling sub-order coordination: If one artisan ships while another is still crafting, the parent `customer_orders` transitions automatically to `PARTIALLY_SHIPPED`. When all sibling sub-orders are delivered, the parent order transitions to `COMPLETED`.
   - Out-of-order webhook protection: Monotonic state guards prevent late or out-of-order scans from regressing already delivered shipments.
4. **Multi-Tenant Customer Privacy & Security:**
   - Multi-tenant tenant isolation: Seller B cannot view, book, or cancel shipments belonging to Seller A (`404 Not Found`).
   - Customer address privacy: Full recipient telephone and street lines are strictly embedded onto authorized carrier waybills and shipping labels. They are never exposed in bulk seller order listings.
   - Public tracking endpoint (`GET /shipping/track/:trackingNumber`): Exposes milestone timestamps and carrier checkpoints without leaking recipient phone numbers or sensitive addresses.
5. **Cryptographic Webhook Ingestion:** Ingests courier webhook callbacks via `POST /shipping/webhooks/:provider` with mandatory HMAC signature verification (`x-delhivery-signature` / `x-courier-signature`). Forged or unsigned webhooks are rejected with `401 Unauthorized`.
6. **Zero Premature Scope Creep:** Zero automated payout disbursement execution (owned by G12/G16); zero manual ledger mutations (G09 owns financial ledger); zero admin console operations (strictly reserved for Gate G12).

---

## 2. Implemented Architecture & Deliverables

### 2.1 Database Enhancements (`packages/db`)

- **Migration `0004_shipping_enhancements.sql`:**
  - Extended PostgreSQL enum `shipment_status` with `DELIVERY_FAILED` and `CANCELLED`.
  - Added columns to `shipments`:
    - `pickup_date` (timestamptz): Scheduled carrier pickup timestamp.
    - `cancellation_reason` (text): Documented reason for shipment cancellation before dispatch.
    - `pickup_address_snapshot` (jsonb): Immutable snapshot of the artisan's workshop origin address.
    - `delivery_address_snapshot` (jsonb): Immutable snapshot of the customer delivery address.
    - `carrier_metadata` (jsonb): Courier routing codes, pickup tokens, and service type details.
  - Verified and applied across `marketplace_dev` and `marketplace_test`.

### 2.2 Validation & Contracts (`packages/validation` & `packages/api-contracts`)

- **Zod Validation Schemas (`packages/validation/src/shipping.ts`):**
  - `carrierCodeSchema`: Enforces supported carriers (`DELHIVERY`, `SHIPROCKET`, `BLUEDART`, `MOCK_COURIER`).
  - `packageDimensionsSchema`: Validates length, width, and height in millimeters ($\ge 1\text{ mm}$, $\le 2500\text{ mm}$).
  - `bookShipmentSchema`: Validates package dead weight in grams ($1\text{ g} \le \text{weight} \le 50,000\text{ g}$), package dimensions, pickup date, and carrier selection.
  - `schedulePickupSchema`: Validates pickup date, time window, and handling instructions.
  - `cancelShipmentSchema`: Requires cancellation reason ($\ge 3$ characters).
  - `serviceabilityQuerySchema`: Validates 6-digit Indian PIN codes for origin and destination.
  - `trackingWebhookPayloadSchema`: Validates carrier webhook payload structure, waybill numbers, status strings, and event timestamps.
- **Shared API Contracts (`packages/api-contracts/src/shipping.ts`):**
  - `ShipmentDto`: Complete shipment details including milestones, dimensions, and waybill numbers.
  - `BookShipmentRequestDto` & `BookShipmentResponseDto`: Waybill creation and booking confirmation contract.
  - `ShippingLabelDto`: Printable label contract containing printable HTML representation and direct label URL.
  - `SchedulePickupRequestDto` & `SchedulePickupResponseDto`: Courier pickup request and token confirmation.
  - `CancelShipmentRequestDto` & `CancelShipmentResponseDto`: Waybill cancellation receipt.
  - `ServiceabilityResponseDto`: Serviceability check with transit time estimate and COD availability.
  - `CustomerTrackingResponseDto` & `OrderTrackingDto`: Multi-vendor tracking view for storefront customers.

### 2.3 Backend Logistics Engine (`apps/api/src/modules/shipping/`)

1. **`IShippingProvider` Interface (`interfaces/shipping-provider.interface.ts`):** Standardized courier contract for checking serviceability, booking shipments, rendering labels, scheduling pickups, cancelling shipments, and verifying webhook HMAC signatures.
2. **`DelhiveryProvider` (`providers/delhivery.provider.ts`):** Integration with Delhivery Express B2C API format with fallback simulation for local environments without live production credentials.
3. **`MockCourierProvider` (`providers/mock-courier.provider.ts`):** Hermetic carrier adapter generating reproducible waybill numbers (`MCKXXXXXX`) and valid HMAC signatures for automated testing.
4. **`ShippingService` (`shipping.service.ts`):**
   - `bookShipment`: Validates sub-order readiness (`READY_FOR_PICKUP`) and payment confirmation (`PAID`), verifies seller ownership, prevents duplicate active bookings (idempotency guard), resolves origin address from `pickup_addresses`, generates AWB from carrier provider, inserts record into `shipments`, logs initial milestone and order timeline event, and records audit entry `COURIER_SHIPMENT_BOOKED`.
   - `getSellerShipment`: Returns sub-order shipment details and milestone history.
   - `getShippingLabel`: Generates printable 4x6" thermal label formatted with barcode, consignee, consignor, dead weight, and dimensions.
   - `schedulePickup`: Requests pickup slot with courier provider and advances shipment status to `PICKUP_SCHEDULED`.
   - `cancelShipment`: Validates pre-dispatch status (`LABEL_CREATED` or `PICKUP_SCHEDULED`), cancels waybill with carrier, and updates status to `CANCELLED`.
   - `processTrackingWebhook`: Verifies cryptographic HMAC signature, resolves shipment, maps carrier status, prevents regressive status changes, updates shipment timestamps (`shippedAt`, `deliveredAt`), transitions sub-order (`READY_FOR_PICKUP` $\to$ `SHIPPED` $\to$ `DELIVERED`), synchronizes parent order (`PARTIALLY_SHIPPED` / `COMPLETED`), and records audit log.
   - `getCustomerOrderTracking`: Aggregates packages across all artisan shops under a single customer order with privacy-safe milestone timelines.
   - `getPublicTracking`: Provides public waybill tracking by tracking number without leaking customer personal data.
   - `checkServiceability`: Queries carrier delivery coverage and transit times between PIN codes.
5. **Controllers:**
   - `SellerShippingController`: Exposes `POST /seller/orders/:subOrderId/shipment/book`, `GET /seller/orders/:subOrderId/shipment`, `GET /seller/orders/:subOrderId/shipment/label`, `POST /seller/orders/:subOrderId/shipment/pickup`, and `POST /seller/orders/:subOrderId/shipment/cancel`. Guarded by `JwtAuthGuard` and `RolesGuard`.
   - `CustomerTrackingController`: Exposes `GET /orders/:orderNumber/tracking`, `GET /shipping/track/:trackingNumber`, and `GET /shipping/serviceability`.
   - `ShippingWebhookController`: Exposes `POST /shipping/webhooks/:provider` with signature validation.

### 2.4 User Interfaces (`apps/seller-portal` & `apps/storefront`)

1. **Seller Portal Order Fulfilment (`apps/seller-portal/src/app/orders/[subOrderId]/page.tsx`):**
   - When in `READY_FOR_PICKUP`: Displays "📦 Book Courier Fulfilment" action.
   - **Booking Modal:** Configurable dead weight (grams), parcel dimensions (L x W x H in mm), pickup date, and courier provider selection (`Delhivery`, `Shiprocket`, `Mock Logistics`).
   - **Active Fulfilment Card:** Displays carrier badge, waybill number, package specs, and real-time courier checkpoints timeline.
   - **Print Label Modal:** Printable 4x6" label preview with barcode lines, consignee destination, consignor origin, and print shortcut.
   - **Schedule Pickup Modal:** Pickup date and morning/afternoon time window selection.
   - **Shipment Cancellation Modal:** Reason input with confirmation before courier dispatch.
2. **Storefront Customer Tracking (`apps/storefront/src/app/orders/[orderNumber]/tracking/page.tsx`):**
   - Global journey visual stepper: Placed $\to$ Handcrafted $\to$ In Transit $\to$ Delivered.
   - Multi-vendor package split: Independent cards for each artisan's package showing shop name, courier, tracking number, estimated delivery date, and chronological checkpoint milestones.
   - Accessible directly via the "🚚 Track Order Fulfilment" button on the checkout confirmation page (`/checkout/success`).

---

## 3. Verification & Evidence

### 3.1 Automated Test Execution

All 17 integration test scenarios in `apps/api/test/shipping.integration.spec.ts` executed against the live test database (`marketplace_test`):

```text
 ✓ test/shipping.integration.spec.ts (17 tests) 147ms
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 1. PIN Code Serviceability > should verify delivery serviceability between valid Indian postal codes
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 1. PIN Code Serviceability > should mark invalid / non-serviceable remote PIN codes as unserviceable
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 2. Fulfilment Eligibility & Multi-Tenant Isolation > should reject booking shipment for an unpaid order
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 2. Fulfilment Eligibility & Multi-Tenant Isolation > should reject booking shipment when sub-order is not in READY_FOR_PICKUP
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 2. Fulfilment Eligibility & Multi-Tenant Isolation > should strictly prevent Seller B from booking a shipment for Seller A sub-order
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 3. Shipment Booking & Waybill Generation > should successfully book a courier shipment and generate AWB for eligible sub-order
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 3. Shipment Booking & Waybill Generation > should reject duplicate booking on an already booked sub-order (Idempotency)
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 4. Shipping Label Generation & Access Control > should generate printable shipping label HTML with barcode, consignor, and consignee
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 4. Shipping Label Generation & Access Control > should reject unauthorized seller attempting to access another seller shipping label
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 5. Courier Pickup Scheduling > should successfully schedule a courier pickup slot
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 6. Tracking Webhook & Order State Synchronization > should reject webhook with missing or invalid cryptographic HMAC signature
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 6. Tracking Webhook & Order State Synchronization > should ingest pickup scan webhook, transitioning shipment to IN_TRANSIT and sub-order to SHIPPED
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 6. Tracking Webhook & Order State Synchronization > should ingest delivery scan webhook, transitioning shipment to DELIVERED and sub-order to DELIVERED
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 6. Tracking Webhook & Order State Synchronization > should ignore out-of-order regressive status webhooks once DELIVERED
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 7. Customer Order Tracking & Public Tracking > should provide comprehensive, redacted customer tracking for order
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 7. Customer Order Tracking & Public Tracking > should provide public tracking by tracking number without leaking customer PII
   ✓ G11: Courier Integration, Shipping Operations & Fulfilment Integration > 8. Shipment Cancellation Safeguards > should prevent cancellation once shipment has already been delivered
```

### 3.2 Monorepo Verification Pipeline (`./scripts/verify-repo.sh`)

```text
==========================================
Running Handcrafted Marketplace Verification
==========================================
[1/6] Checking Node and pnpm versions: Node v22.22.0, pnpm 10.32.1
[2/6] Verifying pnpm frozen lockfile: Verified
[3/6] Verifying code formatting: All matched files properly formatted
[4/6] Running linters across workspaces: 9/9 tasks successful, 0 errors, 0 warnings
[5/6] Running TypeScript type checks: 0 type errors across 10 packages
[6/6] Running automated test suites: 144/144 tests passed in apps/api, 15/15 passed in @repo/db, 210 passed monorepo-wide
[+] Building all monorepo workspaces: 9/9 builds succeeded (@apps/api, @apps/seller-portal, @apps/storefront, @apps/admin-portal, packages)
[+] Validating OpenAPI contracts specification: 74 paths, 331 $ref targets, 100% Valid
==========================================
All Monorepo Verification Checks Passed!
==========================================
```

---

## 4. Acceptance Criteria Evaluation

| Criteria                           | Target                                                      | Result                                                                               | Status  |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------- |
| **Shipping Provider Architecture** | Clean adapter abstraction isolating courier APIs            | `IShippingProvider` implemented for `Delhivery` and `MockCourier`                    | **MET** |
| **Shipment Booking & Waybill**     | Generates AWB, waybill, label URL, stores dimensions/weight | Atomic booking in `shipments` table with status `LABEL_CREATED`                      | **MET** |
| **Fulfilment Eligibility**         | Rejects unconfirmed, unpaid, or invalid state sub-orders    | Strictly enforces `PAID` parent order & `READY_FOR_PICKUP` sub-order                 | **MET** |
| **Multi-Tenant Isolation**         | Seller A cannot access or mutate Seller B shipments         | Queries scoped to `sellerId`; cross-seller access returns 404                        | **MET** |
| **Idempotency Guard**              | Prevents duplicate waybill booking for same sub-order       | Throws 409 Conflict if active shipment already exists                                | **MET** |
| **Shipping Label Document**        | Printable 4x6" document with barcode, consignor, consignee  | `getShippingLabel` generates HTML formatted document                                 | **MET** |
| **Pickup Scheduling**              | Schedules courier arrival slot with pickup token            | Updates status to `PICKUP_SCHEDULED`, records milestone                              | **MET** |
| **Cancellation Safeguards**        | Cancellation permitted only prior to dispatch               | Cancels with carrier; rejects cancellation if `IN_TRANSIT` or `DELIVERED`            | **MET** |
| **Webhook HMAC Validation**        | Rejects unsigned or forged logistics webhooks               | Validates SHA-256 HMAC; rejects forged with 401 Unauthorized                         | **MET** |
| **Order State Machine Sync**       | Courier pickup $\to$ `SHIPPED`; Delivery $\to$ `DELIVERED`  | Transitions sub-orders and updates parent order to `PARTIALLY_SHIPPED` / `COMPLETED` | **MET** |
| **Monotonic Milestone Guard**      | Protects against out-of-order or late scans                 | Regressive transitions ignored once in terminal delivery state                       | **MET** |
| **Customer Order Tracking**        | Storefront tracking view without personal data leakage      | `/orders/[orderNumber]/tracking` displays multi-vendor timeline with redacted PII    | **MET** |
| **OpenAPI Specification**          | 100% valid canonical OpenAPI contracts                      | 74 operations, 331 refs, validated via `scripts/validate-openapi.mjs`                | **MET** |

---

## 5. Mandatory Human Gate Review Request

Gate G11 is fully implemented, verified, and complete. In accordance with platform governance, all code execution halts here.

**Awaiting human review and explicit authorization before proceeding to Gate G12 (Admin & Agency Control Center, Platform Operations & Governance).**

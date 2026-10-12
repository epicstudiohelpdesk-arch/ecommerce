# Domain Event Catalog & Asynchronous Messaging Specification

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G02 Baseline  
**Guarantees:** At-Least-Once Delivery via PostgreSQL Transactional Outbox; Idempotent Consumers

---

## 1. Domain Event Architecture & Envelope Standard

All domain events emitted within the marketplace follow a standardized envelope specification modeled after CloudEvents:

```json
{
  "eventId": "evt_01HXYZ9876ABCDEF",
  "eventType": "order.sub_order_confirmed",
  "eventVersion": "1.0",
  "aggregateType": "SubOrder",
  "aggregateId": "sord_123e4567-e89b",
  "correlationId": "req_9876543210fedcba",
  "causationId": "evt_01HXYZ9876PAYMENT",
  "timestamp": "2026-10-12T08:00:00.000Z",
  "producer": "order-service",
  "payload": { ... }
}
```

### Core Invariants:

1. **Transactional Outbox Persistence:** Events are inserted into the `outbox_events` table inside the same PostgreSQL transaction that modifies aggregate state.
2. **At-Least-Once Delivery:** The outbox relay worker dispatches events to BullMQ/Redis with exponential backoff retries (maximum 5 retries).
3. **Idempotent Consumption:** Every event consumer maintains an `idempotent_event_receipts` table recording `event_id` and consumer name; duplicate arrivals are immediately acknowledged and bypassed.

---

## 2. Canonical Domain Events

### 2.1 Seller Management Events

#### `seller.application_submitted`

- **Version:** `1.0` | **Aggregate:** `SellerProfile`
- **Producer:** Seller Context
- **Consumers:** Admin Compliance Queue, Notification Dispatcher
- **Payload:** `sellerId`, `shopName`, `taxIdType`, `submittedAt`, `documentCount`
- **Idempotency Key:** `sellerId:application:v1`

#### `seller.approved`

- **Version:** `1.0` | **Aggregate:** `SellerProfile`
- **Producer:** Admin Context
- **Consumers:** Seller Context (Shop Activation), Notification Dispatcher (Welcome Email)
- **Payload:** `sellerId`, `approvedBy`, `approvedAt`, `shopSlug`
- **Idempotency Key:** `sellerId:approved`

#### `seller.suspended`

- **Version:** `1.0` | **Aggregate:** `SellerProfile`
- **Producer:** Admin Context
- **Consumers:** Catalog Context (Delist Products), Payout Context (Freeze Balance), Notification Dispatcher
- **Payload:** `sellerId`, `reasonCode`, `suspendedBy`, `dualApprovalRefId`
- **Idempotency Key:** `sellerId:suspended:${timestamp}`

---

### 2.2 Catalog & Moderation Events

#### `catalog.product_submitted_for_review`

- **Version:** `1.0` | **Aggregate:** `Product`
- **Producer:** Catalog Context
- **Consumers:** Admin Moderation Queue
- **Payload:** `productId`, `sellerId`, `productType`, `title`, `basePriceMinor`, `mediaCount`
- **Idempotency Key:** `productId:submit:${version}`

#### `catalog.product_approved`

- **Version:** `1.0` | **Aggregate:** `Product`
- **Producer:** Admin Context
- **Consumers:** Catalog Context, Search Indexer, Notification Dispatcher
- **Payload:** `productId`, `moderatorId`, `approvedAt`
- **Idempotency Key:** `productId:approved:${version}`

#### `catalog.product_published`

- **Version:** `1.0` | **Aggregate:** `Product`
- **Producer:** Catalog Context
- **Consumers:** Search Indexer, Storefront Cache Invalidation
- **Payload:** `productId`, `sellerId`, `slug`, `categoryPath`, `publishedAt`
- **Idempotency Key:** `productId:published:${version}`

---

### 2.3 Inventory & Reservation Events

#### `inventory.stock_reserved`

- **Version:** `1.0` | **Aggregate:** `InventoryReservation`
- **Producer:** Inventory Context
- **Consumers:** Cart Context, Reservation Expiry Job Scheduler
- **Payload:** `reservationId`, `checkoutSessionId`, `items`: `[{ variantId, quantity }]`, `expiresAt`
- **Idempotency Key:** `reservation:${reservationId}`

#### `inventory.reservation_expired`

- **Version:** `1.0` | **Aggregate:** `InventoryReservation`
- **Producer:** Reservation Expiry Worker
- **Consumers:** Inventory Context (Restore Uncommitted Stock), Cart Context
- **Payload:** `reservationId`, `checkoutSessionId`, `releasedItems`: `[{ variantId, quantity }]`
- **Idempotency Key:** `reservation:expired:${reservationId}`

---

### 2.4 Payment & Financial Events

#### `payment.intent_succeeded`

- **Version:** `1.0` | **Aggregate:** `PaymentAttempt`
- **Producer:** Payment Gateway Webhook Ingestion
- **Consumers:** Order Context (Confirm Orders), Ledger Context (Record Double-Entry Journal)
- **Payload:** `paymentId`, `customerOrderId`, `providerReference`, `amountMinor`, `currency`, `method`
- **Idempotency Key:** `gateway:event:${providerEventId}`

#### `payment.intent_failed`

- **Version:** `1.0` | **Aggregate:** `PaymentAttempt`
- **Producer:** Payment Gateway Webhook Ingestion
- **Consumers:** Order Context (Mark Payment Failed), Inventory Context (Release Active Reservations)
- **Payload:** `paymentId`, `customerOrderId`, `failureCode`, `failureMessage`
- **Idempotency Key:** `gateway:event:${providerEventId}`

#### `ledger.journal_posted`

- **Version:** `1.0` | **Aggregate:** `LedgerEntry`
- **Producer:** Financial Ledger Context
- **Consumers:** Seller Balance Projection Worker, Audit Reporting
- **Payload:** `journalBatchId`, `subOrderId`, `entries`: `[{ account, debitMinor, creditMinor }]`
- **Idempotency Key:** `ledger:batch:${journalBatchId}`

---

### 2.5 Order & Fulfillment Events

#### `order.customer_order_placed`

- **Version:** `1.0` | **Aggregate:** `CustomerOrder`
- **Producer:** Order Context
- **Consumers:** Sub-Order Splitting Worker, Notification Dispatcher (Customer Receipt)
- **Payload:** `orderId`, `customerId`, `totalAmountMinor`, `subOrderCount`, `placedAt`
- **Idempotency Key:** `order:placed:${orderId}`

#### `order.sub_order_confirmed`

- **Version:** `1.0` | **Aggregate:** `SubOrder`
- **Producer:** Order Context
- **Consumers:** Seller Notification Service, Inventory Context (Commit Stock)
- **Payload:** `subOrderId`, `parentOrderId`, `sellerId`, `netSellerPayableMinor`, `productTypeSummary`
- **Idempotency Key:** `sub_order:confirmed:${subOrderId}`

---

### 2.6 Shipping & Logistics Events

#### `shipping.label_created`

- **Version:** `1.0` | **Aggregate:** `Shipment`
- **Producer:** Shipping Context
- **Consumers:** Order Context, Notification Dispatcher
- **Payload:** `shipmentId`, `subOrderId`, `carrierCode`, `trackingNumber`, `labelUrl`
- **Idempotency Key:** `shipment:label:${subOrderId}`

#### `shipping.milestone_updated`

- **Version:** `1.0` | **Aggregate:** `Shipment`
- **Producer:** Courier Webhook Adapter / Sync Worker
- **Consumers:** Order Context (Transition Sub-Order to `SHIPPED` / `DELIVERED`), Notification Dispatcher
- **Payload:** `shipmentId`, `subOrderId`, `milestoneStatus`, `location`, `carrierTimestamp`
- **Idempotency Key:** `milestone:${shipmentId}:${milestoneStatus}:${carrierTimestamp}`

#### `shipping.delivered`

- **Version:** `1.0` | **Aggregate:** `Shipment`
- **Producer:** Shipping Context
- **Consumers:** Order Context (Start 7-Day Return Escrow Timer), Customer Review Invitation
- **Payload:** `shipmentId`, `subOrderId`, `deliveredAt`, `proofOfDeliveryUrl`
- **Idempotency Key:** `shipment:delivered:${shipmentId}`

---

### 2.7 Returns, Refunds & Payouts Events

#### `return.requested`

- **Version:** `1.0` | **Aggregate:** `ReturnRequest`
- **Producer:** Customer Context
- **Consumers:** Seller Dashboard Notification, Dispute Timer Scheduler
- **Payload:** `returnRequestId`, `subOrderId`, `customerId`, `reasonCode`, `evidenceMediaUrls`
- **Idempotency Key:** `return:req:${returnRequestId}`

#### `refund.completed`

- **Version:** `1.0` | **Aggregate:** `RefundTransaction`
- **Producer:** Payment / Finance Context
- **Consumers:** Ledger Context (Post Reverse Journal Entries), Order Context, Notification Dispatcher
- **Payload:** `refundId`, `subOrderId`, `amountMinor`, `gatewayRefundId`, `restockInventory`
- **Idempotency Key:** `refund:completed:${refundId}`

#### `payout.settled`

- **Version:** `1.0` | **Aggregate:** `PayoutTransaction`
- **Producer:** Finance Payout Worker
- **Consumers:** Ledger Context, Seller Notification Service
- **Payload:** `payoutId`, `sellerId`, `batchId`, `amountMinor`, `bankUtr`, `settledAt`
- **Idempotency Key:** `payout:settled:${payoutId}`

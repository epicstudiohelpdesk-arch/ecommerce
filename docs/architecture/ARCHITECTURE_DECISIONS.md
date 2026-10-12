# Domain & API Architecture Decision Records (ADRs)

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G02 Baseline  
**Cross-Reference:** Extends baseline decisions [ADR-001 to ADR-014 in DECISION_REGISTER.md](file:///Users/subhamdas/Documents/PROJECTS/ecommerce/docs/architecture/DECISION_REGISTER.md)

---

## Index of Domain & Contract Decisions

- [ADR-015: Multi-Vendor Sub-Order Decomposition & Fulfillment Autonomy](#adr-015-multi-vendor-sub-order-decomposition--fulfillment-autonomy)
- [ADR-016: Atomic Stock Reservation with 15-Minute TTL & Row-Level Locking](#adr-016-atomic-stock-reservation-with-15-minute-ttl--row-level-locking)
- [ADR-017: Double-Entry Ledger Bookkeeping for Escrow & Commission Allocations](#adr-017-double-entry-ledger-bookkeeping-for-escrow--commission-allocations)
- [ADR-018: Normalized Multi-Carrier Shipping Gateway Port](#adr-018-normalized-multi-carrier-shipping-gateway-port)
- [ADR-019: Dual-Approval Protocol for High-Impact Financial & Identity Interventions](#adr-019-dual-approval-protocol-for-high-impact-financial--identity-interventions)
- [ADR-020: PostgreSQL Transactional Outbox for Domain Event Distribution](#adr-020-postgresql-transactional-outbox-for-domain-event-distribution)

---

### ADR-015: Multi-Vendor Sub-Order Decomposition & Fulfillment Autonomy

- **Decision ID:** ADR-015
- **Topic:** Multi-Vendor Order Splitting Pattern
- **Current Decision:** When a customer completes checkout containing items from multiple artisans, the platform creates a single parent `CustomerOrder` and automatically partitions line items into distinct `SubOrder` records—one per unique `seller_id`.
- **Rationale:** Artisans operate out of independent workshops and require autonomous fulfillment lifecycles, separate packaging, individual courier pickups, and isolated commission/payout balances.
- **Alternatives Considered:**
  - _Single Monolithic Order with Seller Item Flags:_ Causes massive race conditions and cross-seller data leakage when updating fulfillment states.
  - _Forcing Customer to Checkout Separately per Seller:_ Degrades conversion rates and customer satisfaction.
- **Trade-offs:** Adds relational complexity in order reporting, returns, and parent status aggregation.
- **Status:** Accepted (Gate G02).

---

### ADR-016: Atomic Stock Reservation with 15-Minute TTL & Row-Level Locking

- **Decision ID:** ADR-016
- **Topic:** Concurrency Control for Handcrafted Inventory
- **Current Decision:** Inventory items will be reserved during checkout initialization using PostgreSQL `SELECT FOR UPDATE` (or atomic conditional decrements into an `inventory_reservations` table) with an explicit 15-minute Time-To-Live (TTL). If payment is not completed within 15 minutes, a background worker automatically releases the reservation.
- **Rationale:** Handcrafted items often have a quantity of 1 (unique one-of-a-kind art pieces). Overselling damages artisan reputation and causes irrecoverable fulfillment failures.
- **Alternatives Considered:**
  - _Redis Distributed Lock Alone:_ Risk of split-brain or data loss if Redis restarts; violates Principle 1 (PostgreSQL is source of truth).
  - _Optimistic Locking at Payment Capture:_ Leaves buyers at risk of being charged only to discover their unique item was purchased seconds earlier by another buyer.
- **Trade-offs:** Inventory is temporarily held during checkout attempts, slightly reducing short-term availability.
- **Status:** Accepted (Gate G02).

---

### ADR-017: Double-Entry Ledger Bookkeeping for Escrow & Commission Allocations

- **Decision ID:** ADR-017
- **Topic:** Financial Data Modeling & Balance Reconciliations
- **Current Decision:** All monetary movements are modeled in an immutable, append-only `ledger_entries` table enforcing double-entry rules. For every sub-order payment capture:
  - Debit: `Asset:PaymentGatewayReceivable` (Gross Amount)
  - Credit: `Liability:SellerEscrowHold` (Artisan Share)
  - Credit: `Revenue:MarketplaceCommission` (Platform Fee)
  - Credit: `Liability:TaxesPayable` (Tax Withholding)
    Balances are never mutated directly; balances are projected from journal entries.
- **Rationale:** Complete auditability for tax compliance, fraud detection, chargeback tracking, and dispute management.
- **Alternatives Considered:**
  - _Mutable balance column on seller table:_ Prone to concurrent write drift, undetectable discrepancies, and impossible audit trails.
- **Trade-offs:** Increases database write throughput; requires rigid accounting invariants.
- **Status:** Accepted (Gate G02).

---

### ADR-018: Normalized Multi-Carrier Shipping Gateway Port

- **Decision ID:** ADR-018
- **Topic:** Logistics & Carrier Integration Architecture
- **Current Decision:** Create an internal `IShippingProvider` adapter interface that maps heterogeneous courier APIs (Delhivery, Shiprocket, BlueDart, EasyPost) into normalized platform shipment milestones: `LABEL_CREATED`, `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RTO_INITIATED`, `RTO_DELIVERED`.
- **Rationale:** Decouples core order fulfillment logic from specific courier SDKs and third-party data formats.
- **Alternatives Considered:**
  - _Directly coupling courier responses to order tables:_ Fragile; breaks when integrating additional regional carriers.
- **Trade-offs:** Requires maintaining transformation layers for each integrated logistics provider.
- **Status:** Accepted (Gate G02).

---

### ADR-019: Dual-Approval Protocol for High-Impact Financial & Identity Interventions

- **Decision ID:** ADR-019
- **Topic:** Application Security & Privileged Operation Safeguards
- **Current Decision:** High-impact administrative actions—specifically manual seller payout releases $> \$1,000$, permanent seller ban overrides, and manual adjustments to ledger balances—require two distinct authenticated staff signatures (`REQUESTED_BY` and `APPROVED_BY`).
- **Rationale:** Mitigates insider threat, rogue employee compromises, and accidental destructive actions in a multi-vendor platform handling artisan livelihood funds.
- **Alternatives Considered:**
  - _Single SuperAdmin override:_ Dangerous single point of vulnerability.
- **Trade-offs:** Introduces slight administrative latency for exceptional manual operations.
- **Status:** Accepted (Gate G02).

---

### ADR-020: PostgreSQL Transactional Outbox for Domain Event Distribution

- **Decision ID:** ADR-020
- **Topic:** Asynchronous Event Delivery & Data Consistency
- **Current Decision:** Any database transaction that mutates core business state inserts corresponding domain events into an `outbox_events` table within the same ACID transaction. An asynchronous worker polls or listens (`LISTEN/NOTIFY`) to dispatch events to BullMQ/Redis for downstream consumers.
- **Rationale:** Solves the dual-write problem. Guarantees at-least-once delivery of notifications, analytics, and third-party integrations even if the message broker is temporarily down.
- **Alternatives Considered:**
  - _Publishing directly to message queue inside HTTP request:_ If the HTTP handler crashes after database commit but before message dispatch, events are lost forever.
- **Trade-offs:** Requires an outbox relay worker and idempotency checking on all event consumers.
- **Status:** Accepted (Gate G02).

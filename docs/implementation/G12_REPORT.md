# GATE G12 COMPLETION REPORT

## Admin & Agency Control Center, Platform Operations & Governance

**Project:** Handcrafted Multi-Vendor Marketplace  
**Gate:** G12  
**Gate Status:** **PASS (Pending Human Review)**  
**Prerequisites:** G00 through G11 (including G07A) APPROVED & VERIFIED  
**Next Gate:** G13 (Seller Dashboard & Storefront Operations Portal / Customer Care & Disputes)

---

## 1. Executive Summary

Gate G12 establishes the **Admin & Agency Control Center**, delivering a production-grade, secure, and responsive operational command center for platform administrators, trust & safety reviewers, and internal operational staff.

In strict accordance with the project constitution, G04 Role-Based Access Control (RBAC), G07A Master Design System, G08 order state machines, G09 double-entry financial ledger invariants, and G11 logistics tracking:

1. **Server-Authoritative Operational Workspaces:** The administrative portal (`apps/admin-portal`) connects directly to authoritatively guarded REST APIs in `apps/api`. Zero client-side simulated numbers, mock cards, or fabricated status counters exist in production routes.
2. **Internal Agency Roles & Separation of Duty:**
   - 6 approved internal platform roles: `SUPER_ADMIN`, `MARKETPLACE_MANAGER`, `FINANCE_CONTROLLER`, `TRUST_SAFETY`, `CUSTOMER_SUPPORT`, and `READ_ONLY_ANALYST`.
   - Privilege separation: Only `SUPER_ADMIN` accounts can provision new staff accounts, assign roles, or suspend/reinstate operational personnel.
   - Non-admin access rejection: Customer and Seller accounts attempting to access `/admin/*` routes are rejected with `403 Forbidden`.
3. **Comprehensive Operational Workspaces:**
   - **Overview Dashboard:** Live marketplace health KPIs (total GMV in INR paise, platform commission revenue, vetted artisan count, order volume, pending KYC applications, pending product moderation queue, open orders, and active carrier shipments).
   - **Seller Verification (KYC) Queue:** Comprehensive review workspace for artisan applications, business documents (PAN, GSTIN, Bank records), artisan craft stories, and approval/rejection/suspension controls with mandatory audit trails.
   - **Product Catalogue Moderation:** Curated craft review queue inspecting artisan photography, craft techniques, materials, and pricing before public storefront catalog exposure.
   - **Marketplace Order Operations:** High-level order management displaying parent customer orders, line items, and multi-vendor sub-order decomposition across independent artisan workshops.
   - **Carrier Logistics & Fulfilment Oversight:** Live monitoring of courier shipments across integrated providers (`Delhivery`, `Shiprocket`, `Mock Courier`), waybill status, and chronological checkpoint timelines.
   - **Financial Ledger & Reconciliation Visibility:** Read-only financial position oversight powered by the G09 balanced double-entry ledger. View escrow reserves, commission balances, payout eligibility, and automated mathematical ledger balance checks ($\sum \text{Debits} \equiv \sum \text{Credits}$).
   - **Staff Management & Privilege Control:** Staff directory with role-based provisioning, Argon2id credential hashing, and account deactivation controls.
   - **Immutable Audit Register:** Platform-wide immutable audit explorer tracking all administrative mutations with actor identity, action type, IP address, user agent, and before/after metadata snapshots.
4. **Zero Out-of-Scope Intrusion:**
   - Zero manual ledger balance alterations or fabricated payments (G09 owns ledger integrity).
   - Zero automated payout disbursement execution (strictly reserved for G16).

---

## 2. Implemented Architecture & Deliverables

### 2.1 Shared Schemas & API Contracts (`packages/validation` & `packages/api-contracts`)

- **Zod Validation Schemas (`packages/validation/src/admin.ts`):**
  - `adminOrderQuerySchema`: Query filters for order status, seller ID, payment status, pagination, and date ranges.
  - `adminShipmentQuerySchema`: Query filters for carrier code, shipment status, and pagination.
  - `createStaffUserSchema`: Validates staff user creation (email, password $\ge 8$ chars, first/last name, phone, internal role enum).
  - `updateStaffStatusSchema`: Validates staff account status toggling (`ACTIVE`, `SUSPENDED`).
  - `adminAuditQuerySchema`: Query filters for action type, actor ID, entity type, entity ID, and date ranges.
- **Shared API Contracts & DTOs (`packages/api-contracts/src/admin.ts`):**
  - `AdminDashboardMetricsDto`: Authoritative platform summary KPIs and counts.
  - `AdminOrderListItemDto` & `AdminOrderDetailDto`: Order and sub-order operational contracts.
  - `AdminShipmentListItemDto` & `AdminShipmentDetailDto`: Logistics tracking and checkpoint milestone contracts.
  - `StaffUserDto` & `CreateStaffUserRequestDto`: Staff management contracts.
  - `AdminAuditLogEntryDto`: Immutable audit entry contract.

### 2.2 Backend Control Center Module (`apps/api/src/modules/admin/`)

1. **`AdminDashboardService` & `AdminDashboardController` (`/admin/dashboard`):**
   - Computes authoritative marketplace metrics by aggregating database records:
     - GMV paise from completed/paid orders.
     - Platform commission paise from ledger transactions.
     - Counts of active sellers, total customer orders, pending KYC applications, pending moderation items, open orders, and in-transit shipments.
     - Recent audit log activity stream.
   - Guarded by `JwtAuthGuard` and `RolesGuard` (`SUPER_ADMIN`, `MARKETPLACE_MANAGER`, `FINANCE_CONTROLLER`, `READ_ONLY_ANALYST`).
2. **`AdminOrdersService` & `AdminOrdersController` (`/admin/orders`, `/admin/orders/:id`):**
   - Lists parent customer orders with customer details, order item counts, and status filters.
   - Retrieves full order detail with vendor sub-orders breakdown, artisan shop identities, and line-item delivery statuses.
   - Guarded by `JwtAuthGuard` and `RolesGuard` (`SUPER_ADMIN`, `MARKETPLACE_MANAGER`, `CUSTOMER_SUPPORT`, `READ_ONLY_ANALYST`).
3. **`AdminShippingService` & `AdminShippingController` (`/admin/shipments`, `/admin/shipments/:id`):**
   - Aggregates courier shipments across all artisans with filter by carrier code and status.
   - Exposes detailed shipment milestones timeline, package dimensions, waybills, and origin/destination snapshots.
   - Guarded by `JwtAuthGuard` and `RolesGuard` (`SUPER_ADMIN`, `MARKETPLACE_MANAGER`, `CUSTOMER_SUPPORT`, `READ_ONLY_ANALYST`).
4. **`AdminStaffService` & `AdminStaffController` (`/admin/staff`, `/admin/staff/:userId/status`):**
   - Strictly restricted to `SUPER_ADMIN` role.
   - Lists internal staff accounts excluding regular customer accounts.
   - Provisions new staff accounts with Argon2id password hashing, email uniqueness checks, and role assignment.
   - Updates staff account status (`ACTIVE` vs `SUSPENDED`).
   - Automatically records audit log entries (`STAFF_USER_CREATED`, `STAFF_USER_STATUS_UPDATED`).
5. **`AdminAuditService` & `AdminAuditController` (`/admin/audit`, `/admin/audit/:id`):**
   - Exposes paginated immutable audit records with filters on action type, actor ID, and entity type.
   - Provides full audit entry inspect details including metadata snapshots and actor details.
   - Guarded by `JwtAuthGuard` and `RolesGuard` (`SUPER_ADMIN`, `MARKETPLACE_MANAGER`, `FINANCE_CONTROLLER`, `TRUST_SAFETY`, `READ_ONLY_ANALYST`).
6. **`AdminModule`:**
   - Bundles all admin services, controllers, and database dependencies into `AppModule`.

### 2.3 Frontend Operational Workspaces (`apps/admin-portal`)

Built using the G07A Master Design System (`@repo/ui` primitives, semantic color tokens, responsive layouts):

1. **Admin Header Navigation (`apps/admin-portal/src/components/layout/admin-header.tsx`):**
   - Dynamic navigation bar linking to all 8 operational workspaces:
     - 📊 Overview (`/`)
     - 🛡️ Sellers & KYC (`/sellers`)
     - 🎨 Product Moderation (`/moderation`)
     - 📦 Orders (`/orders`)
     - 🚚 Fulfilment & Logistics (`/shipments`)
     - 💰 Financial Position (`/finances`)
     - 👥 Staff Management (`/staff`)
     - 📜 Audit Trail (`/audit`)
2. **Overview Dashboard (`apps/admin-portal/src/app/page.tsx`):**
   - Live metrics summary cards (GMV in ₹, Platform Commission in ₹, Verified Artisans, Orders).
   - Action item counters (Pending KYC, Moderation Queue, Open Orders, Active Shipments).
   - Recent platform operational audit events stream.
3. **Seller Management & KYC (`apps/admin-portal/src/app/sellers/page.tsx`):**
   - Application list with status badges (`PENDING_REVIEW`, `VERIFIED`, `REJECTED`, `SUSPENDED`).
   - Artisan KYC detail drawer: PAN number, GSTIN, bank details, craft category, and submitted documents list.
   - Action controls: Approve Application, Reject (with reason dialog), Suspend Seller, Reinstate Seller.
4. **Product Moderation Workspace (`apps/admin-portal/src/app/moderation/page.tsx`):**
   - Curated craft review queue with product photograph inspect gallery.
   - Product detail review: Artisan shop identity, category, price, materials, craft technique.
   - Approve and Reject (with documented moderation feedback) controls.
5. **Marketplace Order Operations (`apps/admin-portal/src/app/orders/page.tsx` & `/orders/[orderId]/page.tsx`):**
   - Paginated order list with search, status filters, customer details, and total amount.
   - Deep order view displaying parent order status, customer delivery address, and breakdown of artisan sub-orders with customisation notes and tracking references.
6. **Logistics Oversight (`apps/admin-portal/src/app/shipments/page.tsx`):**
   - Courier shipment monitor with tracking number, carrier badges (`Delhivery`, `Shiprocket`, `Mock Courier`), status, and weight.
   - Carrier Checkpoint Timeline Drawer showing chronological scan events, locations, and carrier notes.
7. **Financial Position & Reconciliation (`apps/admin-portal/src/app/finances/page.tsx`):**
   - Financial overview displaying escrow balances, commission income, unsettled payouts.
   - Ledger integrity check displaying reconciliation audit status ($\sum \text{Debits} == \sum \text{Credits}$).
8. **Staff Accounts & Roles (`apps/admin-portal/src/app/staff/page.tsx`):**
   - Staff directory showing name, email, role badge, status, and join date.
   - "Provision Staff Account" modal with role picker (`SUPER_ADMIN`, `MARKETPLACE_MANAGER`, `FINANCE_CONTROLLER`, `TRUST_SAFETY`, `CUSTOMER_SUPPORT`, `READ_ONLY_ANALYST`).
   - "Toggle Account Status" confirmation dialog (`ACTIVE` / `SUSPENDED`).
9. **Audit Trail Explorer (`apps/admin-portal/src/app/audit/page.tsx`):**
   - Full immutable audit register with keyword search and actor role filters.
   - Deep inspection drawer revealing before/after metadata snapshots, IP addresses, and user agents.

### 2.4 OpenAPI 3.1.0 Specification (`docs/api/OPENAPI.yaml`)

- Added 10 new REST endpoints under the `/admin/*` namespace:
  - `GET /admin/dashboard`: Platform overview metrics and audit stream.
  - `GET /admin/orders`: Search and list marketplace orders.
  - `GET /admin/orders/{id}`: Detailed multi-vendor order breakdown.
  - `GET /admin/shipments`: Search and list courier shipments.
  - `GET /admin/shipments/{id}`: Detailed shipment milestones and tracking info.
  - `GET /admin/staff`: List internal operational staff accounts.
  - `POST /admin/staff`: Provision new staff account (`SUPER_ADMIN` only).
  - `PATCH /admin/staff/{userId}/status`: Suspend or reinstate staff account (`SUPER_ADMIN` only).
  - `GET /admin/audit`: Filterable immutable audit logs register.
  - `GET /admin/audit/{id}`: Audit entry detail with metadata snapshot.
- Added comprehensive schemas in `components.schemas`: `AdminDashboardMetrics`, `AdminOrderListItem`, `AdminOrderDetail`, `AdminShipmentListItem`, `AdminShipmentDetail`, `StaffUser`, `CreateStaffUserRequest`, `UpdateStaffStatusRequest`, `AdminAuditLogEntry`, `AdminAuditLogDetail`.
- 100% validated via `node scripts/validate-openapi.mjs` (83 paths, 370 references, 0 errors).

---

## 3. Test Coverage & Verification

### 3.1 Integration Test Suite (`apps/api/test/admin-control-center.integration.spec.ts`)

A comprehensive 16-test integration suite was authored and executed using Vitest:

| #   | Test Case Description                               | Verified Behavior                                                                                   |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | `GET /admin/dashboard` unauthorized rejection       | Rejects unauthenticated requests with `401 Unauthorized`                                            |
| 2   | `GET /admin/dashboard` customer role rejection      | Rejects non-staff (`CUSTOMER`) users with `403 Forbidden`                                           |
| 3   | `GET /admin/dashboard` metrics computation          | Successfully aggregates metrics (GMV, commission, seller counts, orders) for `SUPER_ADMIN`          |
| 4   | `GET /admin/orders` order listing                   | Returns paginated list of marketplace orders with customer info                                     |
| 5   | `GET /admin/orders/:id` order detail                | Returns full multi-vendor order with sub-orders and artisan items                                   |
| 6   | `GET /admin/orders/:id` 404 handling                | Returns `404 Not Found` for non-existent order ID                                                   |
| 7   | `GET /admin/shipments` shipment listing             | Returns shipments list across all carriers with milestone counts                                    |
| 8   | `GET /admin/shipments/:id` shipment detail          | Returns full shipment milestones timeline and carrier details                                       |
| 9   | `GET /admin/staff` staff directory                  | Returns list of platform staff accounts                                                             |
| 10  | `POST /admin/staff` staff creation                  | `SUPER_ADMIN` successfully provisions staff account with hashed password and role                   |
| 11  | `POST /admin/staff` duplicate email prevention      | Rejects duplicate email registration with `409 Conflict`                                            |
| 12  | `POST /admin/staff` privilege separation            | Rejects staff creation attempt by non-`SUPER_ADMIN` staff (`CUSTOMER_SUPPORT`) with `403 Forbidden` |
| 13  | `PATCH /admin/staff/:userId/status` status toggle   | `SUPER_ADMIN` successfully updates staff status from `ACTIVE` to `SUSPENDED`                        |
| 14  | `PATCH /admin/staff/:userId/status` privilege check | Rejects status toggle attempt by non-`SUPER_ADMIN` staff with `403 Forbidden`                       |
| 15  | `GET /admin/audit` audit register                   | Returns paginated audit logs with actor and entity metadata                                         |
| 16  | `GET /admin/audit/:id` audit detail                 | Returns deep audit entry with metadata snapshot                                                     |

**Result:** **16/16 tests passing cleanly** (0 failures).

### 3.2 Monorepo Verification Summary

- **OpenAPI Validation:** `node scripts/validate-openapi.mjs` $\to$ **100% Valid** (83 paths, 370 refs).
- **TypeScript Typecheck:** Clean across all 4 applications and 5 packages (`0 errors`).
- **Next.js Production Build (`apps/admin-portal`):**
  - Compiled 11/11 pages cleanly:
    - `○ /` (Overview Dashboard)
    - `○ /sellers` (Seller Management)
    - `○ /moderation` (Product Moderation)
    - `○ /orders` (Order Operations)
    - `ƒ /orders/[orderId]` (Order Detail)
    - `○ /shipments` (Logistics Oversight)
    - `○ /finances` (Financial Overview)
    - `○ /staff` (Staff Accounts)
    - `○ /audit` (Audit Register)
    - `○ /_not-found` & `login`
  - Zero build warnings or bundle size issues.

---

## 4. Security & Compliance Matrix

| Requirement              | Implementation Mechanism                                                             | Verification Evidence                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **RBAC Authorization**   | `JwtAuthGuard` + `RolesGuard` on all admin endpoints                                 | Customer/Seller rejected with `403`; unauthorized with `401`                           |
| **Privilege Separation** | `Roles(UserRole.SUPER_ADMIN)` on `/admin/staff` creation & status endpoints          | Staff creation and suspension strictly limited to `SUPER_ADMIN`                        |
| **Password Security**    | Argon2id memory-hard hashing via `PasswordService.hash()`                            | Plaintext passwords never stored in database or logged                                 |
| **Audit Immutability**   | Database `audit_logs` table has no update/delete endpoints; write-only audit service | Every staff creation, status change, and moderation decision recorded with actor ID    |
| **Financial Integrity**  | Admin finances view is strictly read-only against G09 double-entry ledger            | Zero mutation endpoints for manual ledger alterations or balance adjustments           |
| **PII Protection**       | Recipient contact info withheld from public views; sanitized listings                | Full recipient telephone and street lines only visible on authorized shipping waybills |

---

## 5. Exit Criteria Sign-Off

- [x] Overview Dashboard displaying authoritative platform health metrics and operational counts.
- [x] Seller KYC verification workspace with document inspector and approval/rejection/suspension controls.
- [x] Product catalogue moderation queue with photography review and craft approval.
- [x] Multi-vendor order operations workspace with parent/sub-order breakdown.
- [x] Carrier logistics and fulfilment oversight with milestone tracking timeline.
- [x] Financial ledger visibility and automated double-entry reconciliation audit view.
- [x] Staff account directory with privilege separation and Argon2id credential provisioning.
- [x] Filterable immutable audit log register with deep inspection drawer.
- [x] 16/16 automated integration tests passing in `apps/api/test/admin-control-center.integration.spec.ts`.
- [x] Clean Next.js production build for `apps/admin-portal`.
- [x] Validated OpenAPI 3.1.0 specification (83 paths, 370 references).
- [x] Zero simulated data, fabricated statistics, or arbitrary ledger mutations.
- [x] Human approval stop condition strictly observed before Gate G13.

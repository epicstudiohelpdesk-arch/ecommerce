# API Design Standards & Protocol Specification

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G02 Baseline  
**Base Path:** `/api/v1`  
**Protocol:** HTTPS / REST over JSON

---

## 1. Architectural Conventions

### 1.1 URI & Resource Naming

- All API routes are lowercased and use kebab-case for multi-word path segments.
- Plural nouns denote resource collections (e.g., `/api/v1/products`, `/api/v1/sub-orders`).
- Concrete identifiers are formatted as UUIDv4/v7 strings in route parameters (e.g., `/api/v1/sub-orders/:subOrderId`).
- Sub-resources model containment relationships (e.g., `/api/v1/sub-orders/:subOrderId/shipments`).
- State transition actions that do not fit basic CRUD use expressive verb sub-resources (e.g., `POST /api/v1/sub-orders/:subOrderId/cancel`, `POST /api/v1/seller/onboarding/submit`).

### 1.2 Data Serialization & Field Naming

- JSON is the mandatory interchange format for request and response payloads.
- Payload keys strictly use `camelCase`.
- Database column names (`snake_case`) must never leak directly into API contracts.

### 1.3 Timestamps & Temporal Integrity

- All timestamps must be represented as **ISO 8601 UTC strings** with millisecond precision and a trailing `Z`:
  `2026-10-12T08:30:00.000Z`
- Local timezones or ambiguous epoch integers without units are prohibited.

### 1.4 Safe Monetary Representation

- **Minor Integer Units Rule:** To prevent floating-point calculation errors, all monetary quantities are transmitted as signed/unsigned 64-bit safe integers representing the minor currency unit (e.g., cents, paise, pence):
  ```json
  {
    "subtotalMinor": 4500,
    "shippingFeeMinor": 500,
    "taxMinor": 400,
    "totalMinor": 5400,
    "currency": "USD"
  }
  ```
- Floating-point representations (`45.00`) are strictly prohibited in API schemas and data stores.

---

## 2. Standard Request Headers

| Header             | Required For             | Description                                                                      | Example              |
| ------------------ | ------------------------ | -------------------------------------------------------------------------------- | -------------------- |
| `Authorization`    | Protected Routes         | Bearer token (`Bearer <jwt_token>`) when not using HTTP-only cookies.            | `Bearer eyJhbGci...` |
| `X-Correlation-ID` | All Requests             | Unique distributed trace ID passed across services. Auto-generated if omitted.   | `req_01HXYZ9876`     |
| `Idempotency-Key`  | State Mutating Endpoints | UUID identifying the mutation attempt to prevent duplicate execution upon retry. | `idemp_e89b-4266`    |
| `Content-Type`     | POST / PUT / PATCH       | Must be `application/json` (or `multipart/form-data` for file upload tickets).   | `application/json`   |

---

## 3. Standard Response Envelopes

All API endpoints return standardized response envelopes conforming to `@repo/api-contracts`:

### 3.1 Standard Success Envelope

```json
{
  "success": true,
  "data": {
    "subOrderId": "sord_123e4567-e89b-12d3-a456-426614174000",
    "status": "CONFIRMED",
    "netSellerPayableMinor": 3825,
    "currency": "USD"
  },
  "meta": {
    "timestamp": "2026-10-12T08:30:00.000Z",
    "correlationId": "req_01HXYZ9876"
  }
}
```

### 3.2 Paginated Collection Envelope

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 142,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  },
  "meta": {
    "timestamp": "2026-10-12T08:30:00.000Z",
    "correlationId": "req_01HXYZ9876"
  }
}
```

### 3.3 Error Response Envelope (RFC 7807 Aligned)

```json
{
  "success": false,
  "error": {
    "code": "INVENTORY_INSUFFICIENT",
    "message": "The requested handcrafted item only has 1 unit remaining in stock.",
    "details": {
      "variantId": "var_987e6543-e21b-12d3-a456-426614174000",
      "requestedQuantity": 2,
      "availableQuantity": 1
    },
    "correlationId": "req_01HXYZ9876",
    "timestamp": "2026-10-12T08:30:00.000Z"
  }
}
```

---

## 4. Rate Limiting & Quotas

Endpoints enforce Redis-backed sliding window rate limits communicated via standard headers:

- `X-RateLimit-Limit`: Maximum permitted requests in window.
- `X-RateLimit-Remaining`: Remaining allowance in current window.
- `X-RateLimit-Reset`: Unix timestamp when quota refreshes.

### Quota Tiers:

- **Public Search / Catalog:** 120 req/min per IP.
- **Customer Auth / Checkout:** 20 req/min per IP / Session.
- **Seller Management:** 60 req/min per Authenticated Seller.
- **Payment Webhooks:** 300 req/min (IP whitelist validated).

---

## 5. Security & Data Redaction Invariants

1. **Zero Stack Trace Leaks:** Server errors (HTTP 500) must return generic error messages (`INTERNAL_SERVER_ERROR`). Raw database exceptions, query strings, and stack traces are suppressed in production.
2. **Masked PII:** Credit card numbers, CVVs, passwords, seller tax file numbers, and bank account credentials are sanitized before response serialization and logging.
3. **Private Document Protection:** Government identity cards and tax certificates return short-lived, pre-signed download URLs with a 5-minute maximum TTL.

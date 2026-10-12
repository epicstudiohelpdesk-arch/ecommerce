# Canonical API Error Catalog & Problem Details

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Date:** Gate G02 Baseline  
**Error Standard:** RFC 7807 Problem Details

---

## 1. Error Response Structure

All client error responses return HTTP status codes in the $4xx$ range and server errors in the $5xx$ range, serialized using the canonical error envelope:

```json
{
  "success": false,
  "error": {
    "code": "CANNOT_CANCEL_IN_PRODUCTION",
    "message": "This made-to-order handcrafted item has already commenced production and cannot be automatically cancelled.",
    "details": {
      "subOrderId": "sord_123e4567-e89b-12d3-a456-426614174000",
      "productionStartedAt": "2026-10-12T07:15:00.000Z"
    },
    "correlationId": "req_01HXYZ9876",
    "timestamp": "2026-10-12T08:30:00.000Z"
  }
}
```

---

## 2. Canonical Error Code Dictionary

| Error Code                          | HTTP Status | Domain Context | Meaning & Remediation                                                                       |
| ----------------------------------- | ----------- | -------------- | ------------------------------------------------------------------------------------------- |
| **`UNAUTHENTICATED`**               | 401         | IAM            | Missing or invalid authentication token. Re-authenticate via login.                         |
| **`TOKEN_EXPIRED`**                 | 401         | IAM            | Access token expired. Exchange refresh token to obtain new access token.                    |
| **`UNAUTHORIZED`**                  | 403         | IAM / Security | Insufficient role or tenant permissions for the target resource.                            |
| **`ACCOUNT_SUSPENDED`**             | 403         | IAM / Seller   | User or seller account has been restricted or suspended by moderation.                      |
| **`MFA_REQUIRED`**                  | 403         | IAM            | Second-factor challenge must be passed before accessing privileged action.                  |
| **`VALIDATION_FAILED`**             | 400         | Core           | Request body failed Zod schema checks. Inspect `details` for field errors.                  |
| **`MALFORMED_JSON`**                | 400         | Core           | Request payload is not valid JSON.                                                          |
| **`RESOURCE_NOT_FOUND`**            | 404         | Core           | Specified entity ID does not exist or has been soft-deleted.                                |
| **`SELLER_NOT_VERIFIED`**           | 403         | Seller         | Seller KYC has not completed approval. Cannot publish products or receive orders.           |
| **`SHOP_INACTIVE`**                 | 400         | Seller         | Artisan shop is currently in vacation mode or closed.                                       |
| **`DOCUMENT_INVALID`**              | 422         | Seller         | Uploaded KYC document format or size rejected. Provide PDF/PNG under 10MB.                  |
| **`PRODUCT_NOT_FOUND`**             | 404         | Catalog        | Product or variant does not exist.                                                          |
| **`PROHIBITED_ITEM`**               | 422         | Catalog        | Item flagged by automated policy or moderation as violating handcrafted rules.              |
| **`MODERATION_PENDING`**            | 400         | Catalog        | Listing is awaiting review; cannot be published or updated during review.                   |
| **`INVENTORY_INSUFFICIENT`**        | 409         | Inventory      | Requested quantity exceeds current available inventory balance.                             |
| **`OOAK_ALREADY_SOLD`**             | 409         | Inventory      | Unique one-of-a-kind handcrafted item has already been sold.                                |
| **`RESERVATION_EXPIRED`**           | 410         | Inventory      | 15-minute checkout reservation hold expired. Cart must be re-validated.                     |
| **`PRICE_STALE`**                   | 409         | Cart / Pricing | Artisan adjusted pricing or discounts changed since cart snapshot creation.                 |
| **`CART_EMPTY`**                    | 400         | Cart           | Cannot initiate checkout session with an empty cart.                                        |
| **`ORDER_NOT_FOUND`**               | 404         | Order          | Order ID not found or belongs to another customer/seller.                                   |
| **`INVALID_ORDER_STATE`**           | 409         | Order          | Requested status transition violates the state machine.                                     |
| **`CANNOT_CANCEL_IN_PRODUCTION`**   | 400         | Order          | Made-to-order item has commenced production; self-service cancellation blocked.             |
| **`PAYMENT_DECLINED`**              | 402         | Payment        | External payment gateway declined customer payment method.                                  |
| **`PAYMENT_INTENT_EXPIRED`**        | 410         | Payment        | Gateway payment attempt window closed. Generate new payment intent.                         |
| **`WEBHOOK_SIGNATURE_INVALID`**     | 401         | Payment        | Cryptographic webhook signature failed HMAC verification.                                   |
| **`DUPLICATE_WEBHOOK_EVENT`**       | 200 / 409   | Payment        | Event has already been processed (handled idempotently).                                    |
| **`UNBALANCED_LEDGER_TRANSACTION`** | 500         | Finance        | Financial integrity invariant failed: debits do not equal credits. Transaction rolled back. |
| **`PAYOUT_BLOCKED_DISPUTE`**        | 422         | Finance        | Payout cannot be released because seller has an active customer dispute.                    |
| **`CARRIER_API_ERROR`**             | 502         | Shipping       | Third-party courier API unreachable or rejected waybill generation.                         |
| **`INVALID_PICKUP_ADDRESS`**        | 422         | Shipping       | Courier serviceability check failed for artisan pickup postal code.                         |
| **`DUAL_APPROVAL_REQUIRED`**        | 403         | Admin          | Action requires authorization from a second independent staff member.                       |
| **`RATE_LIMIT_EXCEEDED`**           | 429         | Security       | Too many requests in time window. Back off per `X-RateLimit-Reset`.                         |
| **`INTERNAL_SERVER_ERROR`**         | 500         | Core           | Unexpected exception. Correlation ID logged for investigation.                              |

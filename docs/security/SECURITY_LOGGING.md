# Security Auditing & Operational Logging Specification

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Gate:** Gate G04 Baseline  
**Security Level:** High (Immutable Audit Trail & Compliance)

---

## 1. Overview

This document specifies the security auditing framework implemented in `apps/api/src/modules/audit/audit.service.ts` and backed by the `audit_logs` relational table in PostgreSQL.

Every significant authentication, authorization, session, or multi-tenant boundary event produces an immutable audit record.

---

## 2. Audit Record Data Structure

Stored in `audit_logs`:

| Column          | Type              | Description                                                                |
| :-------------- | :---------------- | :------------------------------------------------------------------------- |
| `id`            | `UUID`            | Primary key generated via `defaultRandom()`                                |
| `actor_id`      | `UUID` (Nullable) | User ID of the identity initiating the action (`null` for anonymous)       |
| `actor_role`    | `VARCHAR(50)`     | Role under which the action was executed (`CUSTOMER`, `SUPER_ADMIN`, etc.) |
| `action`        | `VARCHAR(100)`    | Standardized event identifier (e.g., `AUTH_LOGIN_SUCCESS`)                 |
| `resource_type` | `VARCHAR(100)`    | Target domain entity (e.g., `USER`, `SESSION`, `SELLER`)                   |
| `resource_id`   | `VARCHAR(255)`    | Target domain entity identifier                                            |
| `ip_address`    | `VARCHAR(45)`     | Client IP address (supports IPv4 and IPv6)                                 |
| `user_agent`    | `TEXT`            | Client User-Agent string (sanitized, truncated to 500 chars)               |
| `before_state`  | `JSONB`           | State before mutation (sanitized of sensitive fields)                      |
| `after_state`   | `JSONB`           | State after mutation (sanitized of sensitive fields)                       |
| `metadata`      | `JSONB`           | Contextual event metadata (reason, tags, correlation IDs)                  |
| `created_at`    | `TIMESTAMPTZ`     | Immutable creation timestamp                                               |

---

## 3. Standardized Security Audit Event Catalog

| Action Identifier                           | Trigger Condition                                           | Severity |
| :------------------------------------------ | :---------------------------------------------------------- | :------- |
| `AUTH_REGISTER`                             | New customer identity created                               | Low      |
| `AUTH_EMAIL_VERIFIED`                       | Email verification token successfully consumed              | Low      |
| `AUTH_LOGIN_SUCCESS`                        | Successful credential verification and session issue        | Low      |
| `AUTH_LOGIN_FAILED`                         | Incorrect password or non-existent user attempt             | Medium   |
| `AUTH_LOGIN_BLOCKED`                        | Attempt to authenticate using suspended/deactivated account | High     |
| `AUTH_LOGIN_MFA_CHALLENGE`                  | First-factor verified; MFA challenge ticket issued          | Low      |
| `AUTH_MFA_CHALLENGE_FAILED`                 | Incorrect TOTP token provided during login                  | Medium   |
| `AUTH_LOGIN_MFA_SUCCESS`                    | Second-factor verified; session issued                      | Low      |
| `AUTH_TOKEN_REFRESH`                        | Rotating refresh token consumed and replaced                | Low      |
| `AUTH_LOGOUT`                               | Single session explicitly terminated                        | Low      |
| `AUTH_LOGOUT_ALL_SESSIONS`                  | Account-wide session termination executed                   | Medium   |
| `AUTH_PASSWORD_RESET_REQUESTED`             | Password reset link requested                               | Low      |
| `AUTH_PASSWORD_RESET_COMPLETED`             | Password reset executed; all sessions revoked               | Medium   |
| `AUTH_MFA_ENABLED`                          | Two-factor TOTP activated on account                        | Medium   |
| `AUTH_MFA_DISABLED`                         | Two-factor TOTP deactivated on account                      | High     |
| `SECURITY_CROSS_TENANT_VIOLATION_ATTEMPT`   | Seller attempted to access foreign seller's resources       | Critical |
| `SECURITY_CROSS_CUSTOMER_VIOLATION_ATTEMPT` | Customer attempted to access foreign customer's record      | High     |

---

## 4. Credential Sanitization & Data Protection

To comply with privacy laws (GDPR, DPDP Act) and PCI DSS standards, the `AuditService.sanitizePayload()` method automatically scrubs sensitive keys before writing to the database:

- **Redacted Keys:** Any key containing `password`, `passwordhash`, `secret`, `mfasecret`, `token`, `refreshtoken`, `accesstoken`, `code`, `otp`, or `authorization`.
- **Masking Value:** `[REDACTED]`
- **Recursive Scrubbing:** Nested JSON structures are recursively traversed and sanitized.
- **Fail-Safe Logging:** If database persistence of an audit log fails, the error is written to standard error via the NestJS logger and will not crash the user's primary transaction.

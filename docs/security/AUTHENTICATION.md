# Authentication Architecture Specification

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Gate:** Gate G04 Baseline  
**Security Level:** High (Financial & Multi-Vendor Tenant Security)

---

## 1. Executive Summary

This document specifies the identity verification, password hashing, multi-factor authentication (MFA), and token lifecycles implemented in `apps/api` (`@apps/api`), `@repo/validation`, and `@repo/api-contracts`.

The platform implements defense-in-depth authentication preventing credential credential stuffing, timing attacks, replay vulnerabilities, and unauthorized privilege escalation.

---

## 2. Password Security & Hashing Architecture

### 2.1 Algorithm: Argon2id

In accordance with RFC 9106 and OWASP Password Storage Guidelines, the system employs **Argon2id** (the memory-hard password hashing standard):

- **Algorithm:** Argon2id (`v=19`)
- **Memory Cost ($m$):** 65,536 KiB (64 MiB) in production; scaled in test environments (4,096 KiB) to balance speed and rigor.
- **Time Cost ($t$):** 3 iterations in production; 1 iteration in test environments.
- **Parallelism ($p$):** 4 parallel lanes.
- **Pre-hashing Normalization:** User passwords are submitted over TLS, validated against complexity rules, and directly ingested into the Argon2id native library. Plaintext passwords never touch logs, caches, or persistent storage.

### 2.2 Password Complexity Policy

Enforced server-side in `@repo/validation` (`passwordSchema`):

- Minimum length: 12 characters.
- Maximum length: 128 characters.
- Must include at least 1 lowercase letter (`[a-z]`).
- Must include at least 1 uppercase letter (`[A-Z]`).
- Must include at least 1 numeric digit (`[0-9]`).
- Must include at least 1 special character (`[^A-Za-z0-9]`).

---

## 3. Token & Session Architecture

The platform operates a hybrid dual-mode session model:

1. **Browser Applications (Storefront, Seller Portal, Admin Portal):** `HttpOnly`, `SameSite: 'lax'`, `Secure` cookies.
2. **Programmatic / API Callers:** Standard `Authorization: Bearer <token>` headers.

### 3.1 Token Typology & Parameters

| Token Type               | Medium                      | Algorithm | TTL        | Secret / Storage                          | Replay Protection                          |
| :----------------------- | :-------------------------- | :-------- | :--------- | :---------------------------------------- | :----------------------------------------- |
| **Access Token**         | JWT (Header or Cookie)      | HS256     | 15 minutes | Cryptographic Server Secret               | Short TTL, validated signature             |
| **Refresh Token**        | Opaque Hex String (64-char) | CSPRNG    | 7 days     | Stored as SHA-256 hash in `user_sessions` | Rotating on every refresh, single-use      |
| **Email Verification**   | Signed JWT                  | HS256     | 24 hours   | Cryptographic Server Secret               | Checked against `users.is_email_verified`  |
| **Password Reset**       | Signed JWT                  | HS256     | 15 minutes | Cryptographic Server Secret               | Fingerprinted with current `password_hash` |
| **MFA Challenge Ticket** | Signed JWT                  | HS256     | 5 minutes  | Cryptographic Server Secret               | Short-lived, requires TOTP exchange        |

### 3.2 Access Token Payload Structure

```json
{
  "sub": "b2f67c48-2831-4828-98e3-518296996d91",
  "email": "artisan.indira@example.test",
  "roles": ["APPROVED_SELLER"],
  "sellerId": "c4b12345-6789-4abc-def0-1234567890ab",
  "sessionId": "e8912345-6789-4abc-def0-1234567890ef",
  "type": "access",
  "iat": 1791779310,
  "exp": 1791780210
}
```

---

## 4. Multi-Factor Authentication (MFA) Specification

MFA is mandatory for staff identities (`SUPER_ADMIN`, `FINANCE_CONTROLLER`, `MARKETPLACE_MANAGER`, `TRUST_SAFETY`) and available to all registered users:

### 4.1 Time-Based One-Time Password (TOTP)

- **Standard:** RFC 6238 TOTP (30-second timestep, SHA-1 HMAC, 6 digits).
- **Library:** `otplib`.
- **Enrollment Flow (`POST /auth/mfa/setup`):** Generates CSPRNG Base32 secret and `otpauth://totp/HandcraftedMarketplace:<email>?secret=...` URI.
- **Verification Flow (`POST /auth/mfa/verify`):** Verifies candidate code. Upon success, stores secret in `users.mfa_secret` and activates `users.mfa_enabled = true`. Generates 8 single-use alphanumeric backup recovery codes (`XXXXX-XXXXX`).
- **Privileged Login Challenge Flow (`POST /auth/mfa/challenge`):**
  When an account with MFA enabled logs in, `POST /auth/login` does not issue session tokens; instead, it returns `{ requiresMfa: true, mfaTicket: "..." }`. The caller must submit the ticket and 6-digit TOTP code to `POST /auth/mfa/challenge` to receive the access and refresh tokens.

---

## 5. Timing Attack & Enumeration Defenses

1. **Non-Existent User Login:** When a non-existent email is passed to `POST /auth/login`, the service executes a constant-time dummy Argon2id verification with equivalent cost parameters before rejecting the request.
2. **Uniform Error Messages:** Both invalid passwords and non-existent accounts return identical responses: `Invalid email or password` with HTTP 401.
3. **Password Reset Enumeration:** `POST /auth/forgot-password` returns `{ success: true, message: "If an account exists with this email address, password reset instructions have been sent." }` regardless of whether the email is present in the database.

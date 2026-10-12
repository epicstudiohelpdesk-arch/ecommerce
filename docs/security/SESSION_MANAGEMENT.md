# Session Management & Lifecycle Specification

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Gate:** Gate G04 Baseline  
**Security Level:** High (Session Cryptography & Revocation Invariants)

---

## 1. Overview

This document specifies the server-side lifecycle, rotation semantics, revocation guarantees, and cookie security policies governing user sessions in the Handcrafted Multi-Vendor Marketplace.

---

## 2. Server-Side Session Storage (`user_sessions`)

Every active session is persisted in the PostgreSQL `user_sessions` relational table:

- `id`: UUID Primary Key.
- `user_id`: UUID Foreign Key to `users(id)` with cascading deletion.
- `refresh_token_hash`: Unique `VARCHAR(255)` storing the SHA-256 hash of the 64-character random refresh token. The raw token is **NEVER** stored in the database.
- `user_agent`: Sanitized client identifier (truncated to 500 characters).
- `ip_address`: Client IPv4 or IPv6 address.
- `expires_at`: Absolute session expiration timestamp (default: 7 days).
- `revoked_at`: Timestamp set when the session is explicitly invalidated.

---

## 3. Session Lifecycle State Machine

```
      [ POST /auth/login (or MFA challenge) ]
                        │
                        ▼
                  ┌───────────┐
                  │  ACTIVE   │ ◄────────────────────────┐
                  └─────┬─────┘                          │
                        │                                │
        ┌───────────────┼───────────────┐                │
        │               │               │                │
  [ POST /refresh ] [ EXPIRED ]   [ POST /logout ]   [ Token Rotated ]
        │               │         [ Password Reset ]     │
        ▼               ▼         [ Admin Revoke ]       │
  ┌───────────┐   ┌───────────┐         │                │
  │ ROTATING  │   │  EXPIRED  │         ▼                │
  └─────┬─────┘   └───────────┘   ┌───────────┐          │
        │                         │  REVOKED  │          │
        └────────────────────────►└───────────┘──────────┘
```

### 3.1 Token Rotation

Whenever `POST /auth/refresh` is called:

1. The server computes the SHA-256 hash of the presented refresh token.
2. It queries `user_sessions` where `refresh_token_hash = hash AND revoked_at IS NULL AND expires_at > NOW()`.
3. If not found or already revoked, the request is immediately rejected with HTTP 401.
4. If found, a **NEW** cryptographically secure 64-character refresh token is generated.
5. The session record is updated with the new token hash and extended expiry.
6. A new 15-minute access token is minted.
7. Any subsequent presentation of the old refresh token fails immediately, defeating replay attacks.

### 3.2 Single-Session Logout (`POST /auth/logout`)

- Marks the specific session record as `revoked_at = NOW()`.
- Clears `accessToken` and `refreshToken` cookies on the client.
- The session is immediately unusable for token refresh.

### 3.3 Account-Wide Revocation (`POST /auth/logout?all=true` / `POST /auth/sessions/revoke-all`)

- Executes:
  ```sql
  UPDATE user_sessions
  SET revoked_at = NOW()
  WHERE user_id = :userId AND revoked_at IS NULL;
  ```
- All client devices and background workers associated with this user are instantly logged out.

---

## 4. Browser & Cookie Security Directives

When communicating with browser applications (Next.js storefront, seller portal, admin portal):

- **`HttpOnly` Flag:** Set on all auth cookies (`accessToken`, `refreshToken`) to prevent access from client-side JavaScript, neutralizing Cross-Site Scripting (XSS) credential theft.
- **`SameSite=Lax` Policy:** Prevents the browser from attaching authentication cookies to cross-site requests, providing defense against Cross-Site Request Forgery (CSRF).
- **`Secure` Flag:** Enabled in production environments (`process.env.NODE_ENV === 'production'`) ensuring cookies are transmitted strictly over TLS/HTTPS.
- **`Path=/`:** Confines auth cookies to root application scope.

---

## 5. Cross-Site Request Forgery (CSRF) Mitigation

Implemented in `CsrfProtectionMiddleware` (`apps/api/src/common/middleware/csrf.middleware.ts`):

1. **API / Bearer Callers:** Inherently immune to CSRF because standard cross-site form submissions cannot inject custom `Authorization: Bearer` headers.
2. **Cookie-Authenticated State Mutations (`POST`, `PUT`, `PATCH`, `DELETE`):**
   - The middleware verifies the presence of either:
     - Custom client header: `x-requested-with: XMLHttpRequest` or `x-csrf-token`.
     - Valid `Origin` or `Referer` matching configured `ALLOWED_ORIGINS`.
   - If a cookie-authenticated mutation lacks valid origin/custom headers, the request is terminated with HTTP 403 Forbidden.

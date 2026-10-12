# Account Recovery & Identity Verification Policy

**Project:** Handcrafted Multi-Vendor Marketplace  
**Document Version:** 1.0.0  
**Effective Gate:** Gate G04 Baseline  
**Security Level:** High (Credential Lifecycle & Replay Invariants)

---

## 1. Overview

This document specifies the secure workflows for email address verification, password recovery, session invalidation upon credential changes, and account recovery protections.

---

## 2. Email Verification Workflow

### 2.1 Single-Use Signed Verification Tokens

- **Generation:** On registration (`POST /auth/register`), the system signs a JWT token with type `verify_email` containing `sub: userId` and `email: user.email`, with a 24-hour expiration window.
- **Verification Endpoint:** `POST /auth/verify-email`.
- **State Transition:**
  - Sets `users.is_email_verified = true`.
  - If the user was in `PENDING_VERIFICATION` state, advances to `ACTIVE`.
  - Sets `users.updated_at = NOW()`.
- **Idempotency & Replay Protection:**
  - If the user is already verified, the endpoint safely returns `{ success: true, message: "Email address is already verified" }` without side effects.
  - If the token signature is invalid, tampered, or expired, returns HTTP 400 Bad Request.

---

## 3. Password Recovery Workflow

### 3.1 Step 1: Password Reset Request (`POST /auth/forgot-password`)

- Accepts `{ email: string }`.
- **Account Enumeration Defense:**
  - Queries `users` table for the normalized email.
  - Whether or not the user exists, returns the generic response:
    ```json
    {
      "success": true,
      "message": "If an account exists with this email address, password reset instructions have been sent."
    }
    ```
  - Prevents attackers from probing user existence via API responses or response timing.
- **Token Generation:**
  - When the account exists, the server mints a signed JWT with:
    - `sub`: User ID
    - `email`: Normalized email
    - `pwdFingerprint`: SHA-256 hash of the user's current `password_hash`, truncated to 16 characters (`crypto.createHash('sha256').update(user.passwordHash).digest('hex').substring(0, 16)`)
    - `type`: `password_reset`
    - `exp`: 15 minutes

### 3.2 Step 2: Password Reset Execution (`POST /auth/reset-password`)

- Accepts `{ token: string, newPassword: string }`.
- **Validation:**
  - Verifies token signature and 15-minute expiration.
  - Verifies `newPassword` complexity (minimum 12 characters, uppercase, lowercase, number, symbol).
  - Fetches the user from the database.
  - **Dynamic Replay Invalidation via Fingerprint:**
    Computes the fingerprint of the user's _current_ `password_hash` in the database.
    If it differs from `payload.pwdFingerprint`, the reset token is rejected with:
    `Password reset token has already been used or credentials have changed`.
- **Execution & Invariant Enforcement:**
  1. Hashes `newPassword` using Argon2id.
  2. Updates `users.password_hash` and `users.updated_at`.
  3. **Mandatory Invalidation:** Immediately executes `sessionService.revokeAllUserSessions(user.id)`, revoking **ALL** active sessions across all devices.
  4. Records an immutable audit log entry in `audit_logs`.
  5. Returns `{ success: true, message: "Password has been reset successfully. Please log in with your new password." }`.

---

## 4. Multi-Factor Authentication (MFA) Recovery

### 4.1 Backup Recovery Codes

- During MFA enrollment (`POST /auth/mfa/verify`), the platform generates 8 cryptographically random recovery codes formatted as `XXXXX-XXXXX` (e.g., `A3F9K-98D2E`).
- Recovery codes allow users who have lost access to their authenticator device to regain access without administrator intervention.
- The user is instructed to store these offline in a secure password manager.

### 4.2 Super-Admin MFA Reset Protocol

- If a staff member loses their authenticator and recovery codes:
  1. Identity must be verified through secondary out-of-band communication.
  2. A Super Administrator executes a reset via the admin control panel.
  3. Both the reset event and the approving administrator's ID are immutably logged in `audit_logs`.

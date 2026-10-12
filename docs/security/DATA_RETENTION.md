# Data Retention, Privacy & Archival Policy

**Document Version:** 1.0.0  
**Effective Date:** Gate G03 Baseline  
**Compliance Context:** Digital Personal Data Protection (DPDP) Act, GDPR, Tax & Financial Reporting Standards  
**Status:** Security & Compliance Policy

---

## 1. Data Classification Matrix

| Category                   | Entities Included                                                                               | Sensitivity     | Minimum Retention                                       | Purge / Anonymization Mechanism                                                                         |
| :------------------------- | :---------------------------------------------------------------------------------------------- | :-------------- | :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| **Financial Ledger**       | `ledger_accounts`, `ledger_entries`, `seller_balances`, `payout_batches`, `payout_transactions` | Highly Critical | **8 Years** (Statutory Tax & Audit Requirement)         | **NEVER Purged.** Immutable append-only audit trail.                                                    |
| **Orders & Fulfillment**   | `customer_orders`, `sub_orders`, `order_items`, `shipments`                                     | High            | **7 Years**                                             | PII redacted after 7 years; transactional totals retained for accounting.                               |
| **Security & Audit Logs**  | `audit_logs`                                                                                    | High            | **3 Years**                                             | Partitioned by year; cold-storage archival to WORM (Write Once Read Many) storage.                      |
| **Customer PII**           | `users`, `pickup_addresses`, `customer_orders.shipping_address`                                 | Confidential    | Active user lifetime + **30 days** post-account closure | Anonymized on account deletion request (Right to be Forgotten).                                         |
| **KYC Documents**          | `seller_documents`                                                                              | Confidential    | Active seller tenure + **5 Years** post-termination     | Private object storage purge with audit record retained.                                                |
| **Ephemeral Session Data** | `user_sessions`, `carts`, `cart_items`                                                          | Low             | **30 Days** (Sessions) / **14 Days** (Guest Carts)      | Automated scheduled TTL sweeper batch cleanup.                                                          |
| **Dispatched Outbox**      | `outbox_events`                                                                                 | Internal        | **14 Days** post-successful publication                 | Automated sweeper purges rows where `published = true` and `published_at < NOW() - INTERVAL '14 days'`. |

---

## 2. Right to be Forgotten & PII Anonymization Protocol

When a customer or seller requests account termination under DPDP / GDPR:

### 2.1 The Accounting vs. Privacy Balancing Rule

- **Financial Invariant:** A customer's account closure MUST NOT delete historical sales records, tax liabilities, or ledger postings ($\sum \text{Debits} == \sum \text{Credits}$).
- **Privacy Enforcement:** Personal identifiable attributes are scrubbed or replaced with irreversible cryptographic pseudonyms:

```sql
-- Conceptual PII Sanitization for Account Deletion
UPDATE users
SET email = CONCAT('anonymized_', id, '@deleted.marketplace.internal'),
    first_name = 'Anonymized',
    last_name = 'User',
    phone = NULL,
    password_hash = 'ACCOUNT_DEACTIVATED_TOMBSTONE',
    mfa_secret = NULL,
    status = 'DEACTIVATED',
    updated_at = NOW()
WHERE id = :target_user_id;

-- Revoke all active sessions
DELETE FROM user_sessions WHERE user_id = :target_user_id;
```

---

## 3. Ephemeral Sweeper Routines

1. **Inventory Reservation Sweeper:**
   - Runs every 1 minute.
   - Updates `status = 'EXPIRED'` on `inventory_reservations` where `status = 'ACTIVE'` and `expires_at < NOW()`.
   - Atomically restores held stock to `inventory_items.quantity_reserved`.
2. **Guest Cart Cleanup:**
   - Runs daily.
   - Deletes rows from `carts` where `customer_id IS NULL` and `expires_at < NOW()`.
3. **Outbox Archival:**
   - Runs daily.
   - Cleans up published events older than 14 days to keep the outbox table compact and index scans hot in RAM.

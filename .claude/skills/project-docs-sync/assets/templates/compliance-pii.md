---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Module: <module-name>
Regulations: <DPDP | GDPR | CCPA | HIPAA | PCI DSS | ...>
---

# Compliance & PII — <Module>

## PII inventory

| Field | Table | Category | Sensitivity | Retention | Deletion handler |
|---|---|---|---|---|---|
| `full_name` | `occupant` | Personal identifier | Standard | Active + 90d | Cascade on org delete |
| `phone` | `occupant` | Direct identifier | Standard | 7y (financial) | Soft delete + redact after 30d |
| `email` | `user` | Direct identifier | Standard | Active + 90d | Hard delete on user delete |
| `aadhaar_encrypted` | `occupant` | Government ID | Sensitive | Active + 7y | Hard delete + key destruction |
| `aadhaar_last4` | `occupant` | Tokenised ID | Internal | Same as encrypted | Same |
| `photo_url` | `occupant` | Biometric | Sensitive | Active + 90d | Hard delete from S3 + DB |
| `bank_account` | `payment_method` | Financial | Sensitive | 7y (financial) | Tokenised via Dodopayments; we store last4 only |
| `gps_location` | `delivery_location` | Location | Sensitive | 90d | Auto-purge job |
| `transcript` | `voice_session` | Conversation | Sensitive | 30d | Auto-purge job |
| `chat_message` | `support_thread` | Conversation | Standard | 2y | Per-message delete |

## Sensitivity tiers

| Tier | Encryption at rest | Logging | Admin view |
|---|---|---|---|
| Standard | Native PG encryption | Allowed if needed | Allowed |
| Internal | Native PG | Redacted | Allowed |
| Sensitive | App-level (pgcrypto / Buffer) | Never | Need-to-know |
| Restricted | App-level + key in KMS | Never | Forbidden |

## Retention rules

| Category | Retention | Trigger | Job |
|---|---|---|---|
| Account-active | While account exists | Account delete | `delete-user-data` |
| Financial | 7 years | After last txn + 7y | `purge-financial-records` |
| Marketing | 2 years | Last engagement + 2y | `purge-marketing` |
| Voice transcripts | 30 days | After session end + 30d | `purge-transcripts-cron` |
| Analytics raw | 90 days | Event date + 90d | `purge-analytics-raw` |
| Backups | 30 days | Backup date + 30d | Automatic |

## Right to be forgotten (deletion path)

Triggered by:
- User deletes account from app settings
- Support request
- Regulatory authority request

Steps (orchestrated by `delete-user-data` workflow):

1. Mark `user.scheduled_deletion_at = now() + 30d` (grace period)
2. Send confirmation email with "Cancel deletion" link (30d TTL)
3. After 30d, run deletion:
   - Hard delete from: `user`, `member`, `session`, `personal_*`
   - Soft delete (anonymise) in: `audit_log` (replace user_id with anonymised hash, keep action records for compliance)
   - Hard delete from S3: `user-uploads/<user_id>/*`
   - Hard delete from vector store
   - Hard delete from Redis cache
   - Send tombstone confirmation email
4. Log deletion in `compliance_deletions` table (immutable, hash-chained)

## Right to data portability (export path)

Triggered by user from settings.

Steps:
1. Enqueue `export-user-data` job
2. Worker collects all user-owned data (org-scoped owns + personal records)
3. Generates ZIP: `user-data-<user_id>-<timestamp>.zip`
4. Uploads to S3 with 7-day signed URL
5. Emails user the link

Format:
- Top-level `manifest.json` describing each file
- Per-entity `<entity>.jsonl` files
- Per-file uploads in `files/`

## Encryption at rest

| Field | Method | Key location |
|---|---|---|
| `aadhaar_encrypted` | `pgp_sym_encrypt` (pgcrypto) | `AADHAAR_ENCRYPTION_KEY` (SST Secret, rotated 90d) |
| `bank_account_token` | (tokenised by Dodopayments) | n/a |
| S3 files | SSE-S3 (AES-256) | AWS managed |
| Backups | KMS | AWS managed |

## Key rotation

- 90-day cadence for app-level encryption keys
- Re-encrypt batch job on rotation (over 7d window)
- Old key kept for 30d post-rotation (decrypt-only)

## Access controls

| Field group | Who can read | Who can write |
|---|---|---|
| Standard PII | Owner, Warden — see RBAC matrix | Same |
| Sensitive PII (Aadhaar, biometric) | No one (encrypted, used only for verification) | System on capture |
| Financial | Owner, Warden — Payments | Owner |

## Access log

Every read of PII fields logged to `pii_access_log`:
- `actor_id`, `acting_as` (if impersonation), `entity`, `entity_id`,
  `fields_accessed`, `reason` (if API-triggered), `ip`, `ua`, `created_at`

Retention: 2 years.

## Data Processing Agreement (DPA)

Sub-processors:

| Sub-processor | Purpose | Data shared | DPA on file? |
|---|---|---|---|
| Vercel | Hosting | All app data in transit | Yes |
| Neon | Database | All PII at rest | Yes |
| Cloudflare | CDN + WAF | URL paths, IPs | Yes |
| Upstash | Cache + queues | Limited (no PII) | Yes |
| ZeptoMail | Email | Email content, addresses | Yes |
| Dodopayments | Payment | Payment metadata (no card detail) | Yes |
| Sentry | Error tracking | Stack traces (PII scrubbed) | Yes |
| PostHog | Product analytics | Event data (no PII) | Yes |

## Breach notification

- Detect: WAF alerts + Sentry + manual report
- Triage: within 24h
- Affected user notification: within 72h (DPDP / GDPR requirement)
- Regulator notification: within 72h
- Template: `docs/project/runbooks/breach-notification.md`

## Compliance checklists

### India DPDP
- [ ] Consent capture for processing
- [ ] Notice of processing in plain language
- [ ] Data Principal rights respected
- [ ] Children's data: parental consent for <18
- [ ] Cross-border transfer: only to whitelisted countries

### GDPR (if EU users)
- [ ] Lawful basis documented
- [ ] DPO appointed if required
- [ ] Records of processing
- [ ] DPIA for high-risk processing

### PCI DSS (if cards)
- [ ] No PAN stored, ever (tokenisation via gateway)
- [ ] Quarterly ASV scan
- [ ] Annual SAQ

## Anti-patterns to flag

- Storing raw Aadhaar / SSN / card number
- Logging PII fields without redaction
- Putting PII in Sentry breadcrumbs without scrubbing
- Backups not encrypted
- No key rotation
- "Delete account" only soft-deletes (regulators won't accept)
- PII in URL query strings (gets logged in CDN logs)

## Related
- **Module:** [module.md](./module.md)
- **Project-wide PII inventory:** [compliance-pii-inventory.md](../../shared/compliance-pii-inventory.md)
- **RBAC:** [rbac-matrix.md](../../shared/rbac-matrix.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

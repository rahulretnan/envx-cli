# 06 — Edge Case Guide (24 categories, walked through)

This guide is **NOT** a passive lookup. During Phase 6 step 10, the skill
must walk EVERY applicable category with the user, asking "what should
happen here?" and documenting the answer. Never let a category go silent.

## How to use

For each feature in a module, run this checklist. For each category, either
capture the user's answer OR mark `N/A — <reason>`. Never leave blank.

## The 24 categories

### Behaviour edges

#### 1. Empty states
- No items exist yet
- Search returns nothing
- Filter produces empty result
- First-time-user vs experienced-user variants
- Empty state CTAs

#### 2. Boundary / limits
- Max/min values per field
- Character limits (display vs storage)
- File size + count limits
- Pagination limits
- Per-tier plan limits

#### 3. Permission / access
- User lacks permission (which message, suggest what?)
- Role changed mid-session (kick / refresh / silent?)
- Org access revoked while user is in
- Item archived while viewing
- Shared link revoked while open

#### 4. Concurrency
- Two users edit same item (last-write / OT / lock / conflict UI)
- Item deleted while another user views
- Stale data submission (optimistic update vs refresh prompt)
- Multiple tabs by same user
- Simultaneous bulk operations

#### 5. Network / errors
- Offline (queue / cached read / block)
- Slow connection (skeleton with timeout)
- Request timeout (retry policy)
- 4xx vs 5xx error UX
- Partial failure in batch (which succeeded, which failed)

#### 6. Data integrity
- Duplicate entry (block / merge / allow)
- Required field missing (block)
- Foreign key reference deleted (cascade / nullify / block)
- Corrupted upload
- Invalid character / encoding
- Bidirectional sync drift

#### 7. Time-based
- Token / link expiry
- Session expiry mid-action
- Scheduled item in the past (block / warn / allow)
- Timezone storage vs display
- DST transitions
- Leap-day, leap-second
- Cross-timezone scheduling (e.g. reminder for user in IST scheduled from EST)

#### 8. Deletion
- Soft vs hard delete decision per entity
- Cascade effects (what else gets removed)
- Undo window
- "Permanently delete" double-confirmation
- GDPR right-to-be-forgotten path (different from product-level delete)

#### 9. External dependencies
- Third-party API down (degrade / cache / fail)
- Payment gateway failure (retry / alternate / dunning)
- Email / SMS bounced
- OAuth provider unavailable
- Webhook retries exhausted

#### 10. State transitions
- Invalid state change attempted
- Reverting status (paid → unpaid?)
- State change blocked by another entity's state
- Bulk state change w/ partial failure

### Operational edges (often forgotten — the skill must volunteer these)

#### 11. Rate limiting
- Per-user vs per-IP vs per-org
- Public endpoint limits
- Burst vs sustained
- Response shape when limited (`429` + `Retry-After`)
- Bypass for premium tier

#### 12. Idempotency
- Client retries — must be safe
- Webhook retries from external — must be safe
- Idempotency key location (header / body)
- TTL of idempotency record
- Storage backend (Redis `SET NX EX` recommended)

#### 13. Retry semantics
- Which errors retry, which don't
- Exponential backoff base + max
- Max attempts
- Circuit breaker if 5+ failures
- Retry budget per minute

#### 14. Deduplication
- Webhook replay window
- Same-event dedup window
- Sliding window vs fixed
- Storage of seen-IDs

#### 15. Eventual consistency / read-after-write
- "I created it but don't see it" — explicit cache invalidation? wait?
- Search index lag visible to user
- Replica lag for read replicas
- Optimistic UI updates

#### 16. Queue back-pressure
- Queue depth thresholds for alerting
- Slow consumer behaviour (DLQ vs drop)
- Producer back-pressure (block vs reject)
- Per-tenant queue isolation

#### 17. Cold starts
- First-request latency tolerance (Lambda specifically)
- Provisioned concurrency for critical paths
- Warm-up endpoints

#### 18. Secrets rotation
- How to rotate without downtime
- Versioned secret references
- Detection of stale secret
- Audit of secret access

#### 19. Partial failure semantics
- For batch operations: report which succeeded / which failed
- Transactional vs non-transactional
- Manual retry path for failures only

#### 20. Audit gaps
- Every privileged action audited?
- Impersonation actions distinctly marked
- Audit log retention
- Tamper-evident? (append-only, optional hash chain)

#### 21. Impersonation traces
- Audit shows acting user + impersonated user
- Time-bounded sessions (e.g. 1h max)
- User-facing notification when impersonated
- Withdraw active impersonation

### Distribution edges

#### 22. Multi-region / read replicas
- Read replica routing
- Write conflict potential
- Cross-region replication lag
- Failover

#### 23. Time skew
- Client clock vs server clock
- Token expiry validation w/ skew tolerance
- "Created in future" data

#### 24. Mobile / PWA specific
- App backgrounded mid-action
- Push permission denied
- App update required (force vs warn)
- Background fetch quotas
- iOS WKWebView quirks
- Android back-button semantics
- Deep-link cold launch vs warm

---

## Pre-built edge-case sets per feature type

To accelerate the walk-through, the skill should pre-load these sets:

### Auth feature
- Wrong credentials (don't reveal which)
- Unverified email
- Login from new device (notify?)
- Session expiry mid-action (preserve intent, redirect, complete)
- OAuth provider down
- Account locked / banned
- Reset link expired
- Multiple sessions (allow vs limit)
- Password change requires re-auth
- Account merging when OAuth email matches existing

### Payment / subscription
- Payment failed (retry / alternate / dunning)
- Card expired
- Subscription lapses (grace vs immediate downgrade)
- Upgrade mid-cycle (prorate or full)
- Downgrade with over-limit usage (require cleanup)
- Refund (partial / full / policy)
- Currency conversion (show before confirm)
- Double charge attempt (idempotency)
- Trial expiry handling
- Failed webhook (dunning email path)

### File upload
- Too large (block before upload)
- Invalid MIME
- Upload interrupted (resume)
- Malicious file detected
- Quota exceeded (cleanup vs upgrade)
- Duplicate file (allow / rename / prompt)
- Offline (queue)
- EXIF strip for images
- Presigned URL TTL
- Lifecycle expiration

### Search / filter
- No results (suggestions)
- Special characters (escape / syntax help)
- Too many results (suggest refinement)
- Filter combo empty (which filter caused?)
- Timeout (retry)
- Typo ("did you mean…?")
- Multi-tenant filter at index level
- Synonym dictionary

### Multi-tenancy
- User in multiple orgs (switcher, remember last)
- Removed from org while in
- Org deleted (notify members)
- Cross-org data access (strict 403 + log)
- Org limit reached
- Invitation expiry
- Membership revoked mid-action

### Real-time / collaboration
- WebSocket disconnect (auto-reconnect, backoff)
- Conflicting edits (OT / last-write / CRDT)
- User offline indicator
- Stale presence (heartbeat refresh)
- Message delivery fail

### Mobile / PWA
- App backgrounded (save draft)
- Push denied (graceful, use in-app)
- Offline (cached + queue)
- Low device storage
- Required app update

### i18n
- Unsupported language (fallback)
- RTL UI mirroring
- Date / number formatting per locale
- Translation missing (show key or English)
- Currency display preference

### AI features
- Cost guard / credit metering
- Prompt-injection sanitisation
- Rate limit per user
- Model fallback chain (primary → secondary)
- Response cache for deterministic prompts
- Eval suite (golden set)
- Hallucination guardrails
- User-visible "AI-generated" labelling

### Voice
- Mid-call disconnect (auto-reconnect)
- Push-to-talk gesture
- Background app continues call?
- Mic permission denied
- Audio routing change (Bluetooth → speaker)
- Cross-language switching mid-conversation
- Consent + recording disclosure
- PII masking in transcripts

### India-specific
- WhatsApp template approval pending (fallback to SMS)
- Dodopayments webhook auth failure
- Aadhaar QR malformed (specific error vs generic)
- DPDP "right to be forgotten" path
- GST invoice numbering reset annually

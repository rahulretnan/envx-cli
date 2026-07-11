# 07 — Proactive Suggestion Catalog

The skill must scan EVERY user answer against the triggers below. When a
trigger fires, volunteer the suggestion before moving on. Frame as a
question: "you mentioned X — should we cover Y?"

## Format

`<trigger phrase pattern>` → `<suggestion the skill must volunteer>`

## Trigger catalogue

| If user mentions… | Skill volunteers… |
|---|---|
| "auth" / "login" | Session revocation, MFA, refresh rotation, login-from-new-device alert, account deletion (GDPR), "log out all sessions" UI |
| "email/password" | Password reset flow, breached-password check (better-auth `haveIBeenPwned` plugin), captcha on signup, re-auth required for password change |
| "OAuth" | Provider-down behaviour, account linking, email mismatch between provider and existing user, scope re-consent flow |
| "payment" / "subscription" | Dunning (failed-payment retry), grace period, proration on plan change, refund policy + flow, tax calculation, invoice storage + numbering, webhook idempotency, double-charge protection |
| "file upload" | Max size + count, MIME validation, virus scan, presigned URL TTL, EXIF strip for images, S3 lifecycle for cleanup, private vs public bucket separation |
| "notifications" | Per-channel opt-out, quiet hours by timezone, throttling (max N/day), template versioning, fallback channel when primary fails, frequency-cap per event type |
| "search" | Multi-tenant filter at index level, typo tolerance, synonym dictionary, recency vs relevance ranking, index rebuild strategy, query analytics |
| "mobile app" | Push provider (FCM/APNs vs Expo Push), OTA update strategy (EAS Update), force-update version gate, deep-link handling, biometric unlock, offline queue, app-state restoration |
| "admin panel" | Impersonation audit, separate auth scope, IP allowlist, MFA enforced, action audit trail with diff, view-only-mode |
| "API for integrators" | Rate limit per key, key rotation, scoped permissions per key, webhook signature scheme, idempotency keys, deprecation policy + sunset header |
| "multi-tenant via orgs" | Cross-org data access guard, org deletion (data export?), org name conflict, member removal mid-action, invitation expiry, owner transfer |
| "real-time" | Reconnect strategy, presence stale detection, conflict resolution (last-write vs OT vs CRDT), back-pressure when subscriber slow, message ordering guarantees |
| "AI feature" | Cost guard / credit metering, prompt-injection sanitisation, rate limit per user, model fallback chain, response cache for deterministic prompts, eval suite, user-visible "AI-generated" labelling |
| "voice agent" | PII masking in transcripts, Custom-LLM seam for privacy, transcript retention policy, recording consent disclosure, multi-language voice fallback, mid-call disconnect handling |
| "India market" | Aadhaar handling (encryption at rest, last-4-only display), DPDP Act compliance, GST invoice numbering, WhatsApp template approval flow, ap-south-1 region, INR pricing, regional language support |
| "compliance" | PII inventory, retention schedule, deletion path (right-to-be-forgotten), data export (right-to-portability), encryption at rest, access log, breach notification path |
| "scheduled jobs" | Idempotency, retry policy, DLQ, alerting on failure, max runtime budget, cold-start mitigation, secret rotation safety |
| "webhooks (incoming)" | Signature verification, idempotency key, replay window, log retention, manual retry endpoint, replay-attack protection |
| "webhooks (outgoing)" | Retry with exponential backoff, dead letter, customer-visible delivery log, secret rotation, max payload size, allowlist of customer URLs |
| "migration" / "rename" | Backward-compat window, dual-write strategy, deprecation notice, rollback plan, data-backfill job |
| "internal team only" | Audit log, session timeout, IP allowlist, MFA, "view as" without write |
| "free tier" | Abuse prevention, rate limit, captcha, email-domain blocklist, account merging if duplicate, soft-limit warnings |
| "export" / "report" | Async generation, signed-URL delivery (24h TTL), format options (CSV/PDF/XLSX), email-on-ready, retention, max-row limit |
| "import" / "CSV" | Column-mapping UI, validation report email, batch size, partial-failure semantics, undo (delete-by-import-id) |
| "comments" / "mentions" | Notification fan-out, edit history, soft-delete vs hard-delete, mention parser, rate-limit per thread |
| "settings" | Org vs user scoping, defaults inheritance, validation, propagation to active sessions, undo |
| "search engines" / "Google" / "SEO" | Sitemap, robots.txt, structured data, canonical URLs, OG image generation, server-rendered metadata |
| "share" / "public link" | Token expiry, view-once option, revoke control, view-tracking, password protection, audit who viewed |
| "approval" / "review" | Approver pool, escalation, reminder cadence, audit, "force approve" admin override |
| "draft" / "auto-save" | Save cadence, conflict with concurrent edits, draft expiry, publish-vs-save semantics |
| "history" / "version" | Diff view, restore-to-previous, retention, who-edited tracking |
| "notification preferences" | Per-event-type toggles, channel preference, frequency cap, quiet hours, snooze |
| "team" / "invite" | Invitation expiry, role on accept, email-mismatch handling, rejoin after removal, max members per plan |
| "billing" / "usage-based" | Metering accuracy, double-count protection, late-arriving events, customer-visible usage graph, alerts at thresholds |
| "AI generation" / "queue" | Progress UI (live updates), cancellation, partial-result handling, error recovery, cost display |
| "dashboard" / "analytics" | Date range default, timezone handling, drill-down, export, comparison period, refresh cadence |
| "rich text" / "editor" | Paste sanitisation, image upload + resize, mention triggers, slash commands, auto-link, draft persistence |
| "scheduling" / "calendar" | Timezone storage, recurrence rules (RRULE), conflict detection, ICS export, third-party calendar sync, all-day vs timed |
| "geo" / "delivery" / "address" | PostGIS, geocoding service + cache, fallback when service down, address autocomplete debounce, manual coordinate override |
| "phone" / "OTP" | Provider fallback, rate limit per number, voice-OTP fallback, internationalization (+ country code parsing) |
| "form" / "wizard" | Auto-save per step, jump-back navigation, validation on blur vs submit, "abandon" recovery, conditional fields |
| "table" / "list" | Default sort, column persistence per user, column resize, row selection state, pagination vs infinite scroll, density toggle |
| "audit log" / "history" | Tamper-evident (hash chain), retention, search + filter, export, role-based visibility |
| "feature flag" | Per-org override, kill switch, default state, rollout schedule, A/B variant config, observability of flag state |
| "PII" | Field-level encryption, masking in logs/Sentry, masking in admin view, deletion path, access log |
| "kids" / "minors" | Age-gate floor, parental consent flow, restricted features by age, COPPA/DPDP-Junior considerations |
| "health" / "medical" | HIPAA scope, BAA with vendors, audit, encryption, role-based access, data residency |
| "financial" / "money" | PCI DSS scope, tokenization, reconciliation, audit, retention (7 years usually), GST/tax |
| "global" / "international" | Multi-region strategy, currency conversion, language fallback, timezone display, regulatory checkboxes per region |
| "no tests" / "skip tests" | Push back: zero tests is your top recurring gap (per audit). At minimum: integration tests for critical paths. Offer Vitest + Playwright skeleton. |
| "we'll add it later" | Push back: "later" often means "never". Capture as an open question with explicit defer-until trigger. |
| "MVP" / "ship fast" | Volunteer scope-cut suggestions: skip i18n, skip mobile, skip integrations, ship single-region. But still capture full doc — flag MVP-skipped items. |

## Anti-pattern triggers (steer user away)

| If user proposes… | Skill pushes back with… |
|---|---|
| Storing raw passwords | "Better Auth handles hashing — never store raw" |
| Storing raw API keys | "SHA-256 hashed at rest, shown once on creation" |
| Using `db:push` for migrations | "Always generate migrations + drizzle-kit migrate" |
| Single Vercel project switching via `.vercel/{app,admin}.project.json` swap | "Use one Vercel project per app — swap pattern is fragile" |
| Custom Upstash REST client | "@upstash/redis + @upstash/ratelimit handle this — avoid reinventing" |
| Env var > 4 KB | "Lambda env limit — use SST Secret or Secrets Manager" |
| Sentry only on backend | "Wire @sentry/nextjs and @sentry/expo from day 1 — backfill is painful" |
| Permission table duplicated in router | "Import from packages/auth — duplicates drift" |
| Drizzle in a Hasura+Amplify project | "Hasura is your ORM — Drizzle duplicates" |
| Expo Push at scale | "Direct FCM + APNs via firebase-admin scales better past ~10k DAU receivers" |
| Stripe for India-only product | "Dodopayments has better INR experience + Better Auth plugin" |
| NativeWind for new Expo project | "Uniwind 1.6 is the newer successor" |
| Cognito for greenfield BTS project | "Better Auth more flexible and matches the rest of the stack" |

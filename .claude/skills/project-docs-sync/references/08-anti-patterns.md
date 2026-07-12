# 08 — Anti-Patterns (codebase audit findings)

These are recurring gaps observed across askshelf, weesli, hostelsync,
wrytze, rankze, tiaime. The skill must:
- Warn the user during discovery if their plan trends toward any of these.
- Add a "Known anti-patterns to avoid" section in the generated CLAUDE.md.
- Flag them during Phase 10 verification.

## 1. CLAUDE.md drift

Claims in CLAUDE.md ("uses TanStack Router file-based", "fetch policy is
network-only", "tests via Vitest + Playwright") diverge from actual code.

**Mitigation**: every quarter, run `validate-docs.ts` to spot drift. The
skill includes a doc-vs-code drift checker.

## 2. Permission table duplication

`packages/auth/permissions.ts` and `packages/api/src/index.ts.rolePermissions`
both define role-grants and drift over time.

**Mitigation**: single source of truth in `packages/auth`. Import from there
in every router. The skill's RBAC template explicitly points to one location.

## 3. Sunset code lingering past sunset date

Cookie-cleanup middleware marked "remove after 2026-03-26" still live in
May 2026 (askshelf).

**Mitigation**: CI grep for `remove after \d{4}-\d{2}-\d{2}` against today's
date. The skill includes a `scripts/check-sunset-code.sh` template.

## 4. README claims tests, none exist

README/CLAUDE.md says "Vitest + Playwright" but no test files. All 6
audited projects had this gap.

**Mitigation**: skill generates a `test-plan.md` per module with at least
critical-path placeholders. Quarterly reality-check.

## 5. Custom Upstash REST client when libraries exist

Hand-rolled Redis wrapper when `@upstash/redis` + `@upstash/ratelimit` would
shave hundreds of lines.

**Mitigation**: skill recommends the libraries by default in templates.

## 6. Sentry only on backends

`@sentry/node` wired on the API but no `@sentry/nextjs` or `@sentry/expo`.

**Mitigation**: skill's integrations checklist requires Sentry on all
frontends from day 1.

## 7. Lambda env > 4 KB silently breaks

GCP service account JSON or large config breaks deploys.

**Mitigation**: skill recommends SST Secret for any var > 1 KB.

## 8. CloudFormation circular dependencies in Amplify

SQS queue ↔ auth λ ↔ auth resource creates nested-stack cycles. tiaime
documents the workaround (hoist queue stack into authStack).

**Mitigation**: skill includes a checklist + canonical hoist pattern in
Archetype B recipe.

## 9. Trial expiry computed in middleware vs persisted

`createdAt + 60d` computed on every read instead of persisted at signup.
Couples billing logic to read paths.

**Mitigation**: skill recommends persisting `trialEndsAt` at signup.

## 10. Single Vercel project + .vercel JSON swap

Fragile pattern to deploy multiple apps from one Vercel project. Prefer
one Vercel project per app.

**Mitigation**: skill recommends per-app Vercel projects.

## 11. Storing raw Aadhaar / sensitive ID numbers

India apps storing full Aadhaar without encryption.

**Mitigation**: skill volunteers encryption at rest + last-4-only display.

## 12. No webhook idempotency

Razorpay / Dodopayments webhooks processed without idempotency key check —
risks double-counting on retry.

**Mitigation**: skill's webhook template requires Redis `SET NX EX 48h`.

## 13. Drizzle in a Hasura+Amplify project

Two ORMs in one project — confusion + drift.

**Mitigation**: skill enforces archetype consistency in code samples.

## 14. Inline rate-limit code

Hand-rolled rate-limit in route handlers vs middleware. Hard to maintain.

**Mitigation**: skill recommends middleware-based rate limit using
`@upstash/ratelimit` sliding-window.

## 15. Mixing `dayjs.utc()` and `new Date()` for ICS payloads

Tiaime banned `dayjs.utc()` factory because of subtle bugs in ICS / RRULE
payloads.

**Mitigation**: skill recommends a single time-utility module with
`toISOString()`-derived helpers.

## 16. NativeWind on new Expo projects

NativeWind is being superseded by Uniwind 1.6 + Tailwind v4.

**Mitigation**: skill recommends Uniwind for any post-2026-Q1 project.

## 17. Permission checks inline in route handlers

Per-route `if (role !== 'admin')` instead of middleware.

**Mitigation**: skill recommends middleware pattern (e.g. `protectedProcedure`,
`adminProcedure`, `subscribedProcedure` from hostelsync).

## 18. Webhook handlers without signature verification

Public endpoints trusting POST body without HMAC check.

**Mitigation**: skill's webhook template requires signature verification.

## 19. No DLQ on queues

Failed jobs lost silently.

**Mitigation**: skill requires DLQ + Sentry alert on every queue.

## 20. ImageOptimization disabled on Vercel

`unoptimized: true` in `next.config.js` to "avoid bandwidth costs" — leads
to massive LCP regression. Better to use S3 + on-demand sharp.

## 21. Storing JWT in localStorage

XSS vector. Use httpOnly cookie.

**Mitigation**: skill defaults to Better Auth's httpOnly cookie pattern.

## 22. Mobile push via Expo Push at scale

Works under 10k DAU but rate-limits hit hard above.

**Mitigation**: skill recommends direct FCM + APNs.

## 23. Mixing oRPC public REST routes

Trying to expose oRPC procedures as REST. Better to write hand-rolled
`/api/v1/*` routes — integrators expect REST semantics.

## 24. Skipping `org-scoped` rate limits

Per-IP rate-limit on org-scoped endpoints means a noisy single org from
one office IP can DoS others.

**Mitigation**: org-scoped rate limit on tenant-scoped routes.

## 25. Missing observability on AI calls

LLM cost, latency, token count not tracked → no cost optimisation.

**Mitigation**: skill recommends `lib/ai.ts` wrapper that logs every call.

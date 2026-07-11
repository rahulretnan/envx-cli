---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Module: <module-name>
---

# Test Plan — <Module>

## Coverage targets

| Layer | Target |
|---|---|
| Critical paths | 100% covered by integration or e2e tests |
| Pure functions (utils, validators) | 80% line coverage |
| Service functions | 70% line coverage |
| UI components (snapshot + interaction) | Critical components only |

Total numerical target is misleading — coverage of **critical paths** matters
more than overall %.

## Critical paths

List every flow where a regression would harm a user. Each must have at
least one automated test.

| # | Critical path | Type | File |
|---|---|---|---|
| 1 | User signs up via Google OAuth | e2e (Playwright) | `e2e/auth/signup-google.spec.ts` |
| 2 | Owner creates first <entity> | e2e | `e2e/<module>/create.spec.ts` |
| 3 | Warden cannot vacate (permission) | integration | `tests/<module>/vacate-permission.test.ts` |
| 4 | Bulk import handles malformed CSV | integration | `tests/<module>/bulk-import-errors.test.ts` |
| 5 | Webhook idempotent under retry | integration | `tests/webhooks/<provider>-idempotency.test.ts` |
| 6 | Trial expires at exactly 60d | unit | `tests/billing/trial-expiry.test.ts` |
| 7 | Multi-tenant: cross-org read blocked | integration | `tests/<module>/tenant-isolation.test.ts` |
| 8 | Rate limit returns 429 | integration | `tests/api/rate-limit.test.ts` |
| 9 | State machine: invalid transition rejected | unit | `tests/<module>/state-machine.test.ts` |
| 10 | Export job produces valid CSV | integration | `tests/<module>/export.test.ts` |
| 11 | Sentry receives error w/ PII scrubbed | integration | `tests/observability/sentry.test.ts` |
| 12 | Right-to-be-forgotten deletes all PII | integration | `tests/compliance/delete-user.test.ts` |

## Stack

| Layer | Tool |
|---|---|
| Unit | Vitest |
| Integration | Vitest + `@testing-library/react` + `msw` |
| e2e (web) | Playwright |
| e2e (mobile) | Maestro (Expo) |
| Visual regression | Chromatic / Percy (optional) |
| Load | k6 |
| API contract | OpenAPI-driven tests via `@orpc/openapi` derivative |

## Setup

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event \
  msw playwright @playwright/test maestro k6
```

Vitest config in `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    environment: 'node',          // 'jsdom' for component tests
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
    setupFiles: ['./tests/setup.ts'],
  },
});
```

Playwright config in `playwright.config.ts`. Default baseURL = local Vercel
preview from `vercel dev`.

## Test data / fixtures

- Use `@faker-js/faker` for synthetic data
- Per-test database via `pg-mem` (fast unit) or ephemeral Neon branch (integration)
- For Hasura archetype: `hasura-cli migrate apply` against a test DB

## Mocks

- HTTP: `msw` server
- LLM / AI Gateway: mock with deterministic fixtures
- LiveKit: no-op SFU mock
- Email (ZeptoMail): in-memory transport, assert sends
- Payment (Dodopayments): test-mode keys + fake webhook trigger
- WhatsApp: dry-run flag

## Running tests

```bash
pnpm test                    # unit + integration
pnpm test:watch
pnpm test:coverage
pnpm test:e2e                # Playwright
pnpm test:e2e:debug
pnpm test:mobile             # Maestro
pnpm test:load               # k6 — opt-in
```

CI:
```yaml
# .github/workflows/test.yml
- run: pnpm test
- run: pnpm test:e2e
- if: github.event_name == 'pull_request'
  run: pnpm test:load -- --duration=2m
```

## Test naming convention

```
<module>.<feature>.<scenario>.test.ts
e.g. occupant.create.happy-path.test.ts
e.g. occupant.create.permission-denied.test.ts
```

## What we test for each procedure

For every oRPC procedure / API endpoint, at minimum:
- Happy path
- Validation rejection (invalid input)
- Auth missing (returns 401)
- Permission missing (returns 403)
- Not found (returns 404)
- Tenant isolation (other org's data not visible)
- Rate limit (after N calls returns 429)
- Idempotency (replay returns original)

## What we test for each workflow

- Happy path end-to-end
- Each documented failure scenario
- Audit log entry created
- Telemetry event fired
- Side-effects fired (email, queue, webhook)

## Visual regression (optional)

- Capture snapshots of every page in `<module>` empty/loading/error/normal states
- Run on PR via Chromatic

## Performance tests

- k6 against staging:
  - `<entity>.list` at 100 RPS for 5 min — verify p95 < target
  - `<entity>.create` at 20 RPS for 5 min — verify p95 < target

## Accessibility tests

- `vitest-axe` on critical pages
- Manual screen-reader smoke test per release

## Test debt log

Track gaps explicitly:

| Path | Why deferred | Owner | Due |
|---|---|---|---|
| Bulk import 10k rows | Need staging data | — | post-MVP |

## Related
- **Module:** [module.md](./module.md)
- **Observability:** [observability.md](./observability.md)
- **NFR:** [nfr.md](../../shared/nfr.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

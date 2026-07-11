---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Module: <module-name>
---

# Observability — <Module>

## Telemetry events

| Event name | Props | When fired | Destination |
|---|---|---|---|
| `<entity>.list.viewed` | `{ orgId, count, filterCount }` | List page render | PostHog |
| `<entity>.created` | `{ entityId, orgId, actorId }` | Successful create | PostHog + DB |
| `<entity>.created.failed` | `{ orgId, actorId, errorCode }` | Failed create | PostHog + Sentry |
| `<entity>.updated` | `{ entityId, orgId, actorId, changedFields }` | Update | PostHog + DB audit |
| `<entity>.archived` | `{ entityId, orgId, actorId }` | Archive | PostHog + DB audit |
| `<entity>.export.requested` | `{ orgId, actorId, format, rowCount }` | Export trigger | PostHog |
| `<entity>.export.completed` | `{ exportId, orgId, durationMs }` | Export job done | PostHog |

## Sentry

- Every `*.failed` event creates a Sentry breadcrumb
- 5xx responses captured automatically
- Errors include: `orgId`, `userId`, `traceId`, `procedureName`
- Sample rate: 1.0 for errors, 0.1 for transactions
- PII scrubbing: `email`, `phone`, `aadhaar*` redacted via `beforeSend`

## Logging

| Level | When | Example |
|---|---|---|
| `error` | 5xx, unhandled exception | `{ event, error, traceId }` |
| `warn` | Permission denied, rate limited, validation | `{ event, code, userId }` |
| `info` | State transition, important action | `{ event, entityId }` |
| `debug` | Detailed flow | Off in production |

Structured logging via `pino`:
```typescript
logger.info({ event: '<entity>.created', entityId, orgId }, 'Created');
```

## Dashboards

### PostHog — `<Module>` funnel

1. Page viewed (`<entity>.list.viewed`)
2. Create initiated (`<entity>.create.initiated`)
3. Create completed (`<entity>.created`)
4. First edit (`<entity>.updated`)

Tracked weekly cohort retention.

### PostHog — `<Module>` health

- `<entity>.create.failed` rate (target < 1%)
- Export latency p95 (target < 30s)
- Bulk import error rate per batch

### CloudWatch / Datadog — Backend health

- API procedure p95 latency per route
- Lambda invocations + errors per worker
- DB connection pool usage
- Redis cache hit rate

## Alerts

| Condition | Severity | Channel |
|---|---|---|
| `<entity>.create.failed` rate > 5% over 5min | P1 | Slack #alerts |
| Export job p95 > 5 min | P2 | Slack #ops |
| DLQ depth > 0 | P1 | Slack #alerts + PagerDuty |
| Hasura subscription disconnect spike | P2 | Slack #ops |
| 5xx rate > 1% over 5min | P1 | PagerDuty |

## SLOs

| SLO | Target | Window |
|---|---|---|
| API list latency | p95 < 500 ms | 30d |
| API mutation success | 99.9% | 30d |
| Email delivery | 99.5% | 30d |
| Page LCP | p95 < 2.5 s | 30d |

## Distributed tracing

- Trace ID propagated via `X-Trace-Id` header
- Spans:
  - HTTP → server (auto)
  - oRPC procedure (manual span name = `<router>.<procedure>`)
  - DB queries (auto via Drizzle instrumentation if enabled)
  - External calls (manual)

## On-call runbook

Common incidents:
- **`<entity>.create.failed` alert firing** → check Sentry for top error;
  if validation, check recent client deploy; if 5xx, check downstream
- **DLQ depth > 0** → see `async-jobs/job-<name>.md` recovery section
- **Hasura disconnects spiking** → check Hasura container logs + Postgres
  connection limits

## PII / log redaction

Logged-but-redacted fields:
- `email` → first letter + `*` + domain
- `phone` → last 4 digits only
- `aadhaar_*` → never logged
- Stack traces from PII fields → automatically scrubbed in `pino-pretty`

## Related
- **Module:** [module.md](./module.md)
- **NFR:** [nfr.md](../../shared/nfr.md)
- **Async jobs:** [async-jobs/](./async-jobs/)
- **Compliance:** [compliance.md](./compliance.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

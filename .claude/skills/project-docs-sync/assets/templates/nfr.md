---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Scope: Project-wide
---

# Non-Functional Requirements

## Performance budgets

### Frontend

| Metric | Target (p95) | Notes |
|---|---|---|
| TTFB | 200 ms | Vercel edge |
| LCP | 2.5 s | Mobile 4G |
| FID / INP | 100 ms | |
| CLS | 0.1 | |
| Initial JS payload | 180 KB gzip | Per route |
| Image budget | 200 KB | Above-the-fold |

### Backend

| Route class | p50 | p95 | p99 |
|---|---|---|---|
| Read (cached) | 20 ms | 80 ms | 200 ms |
| Read (miss) | 80 ms | 400 ms | 800 ms |
| Mutation | 100 ms | 500 ms | 1500 ms |
| Heavy (export, bulk) | async | async | async |

### Database

| Query class | p95 | Note |
|---|---|---|
| Indexed list | 50 ms | per query |
| Single PK lookup | 5 ms | |
| Aggregate | 200 ms | only with proper indexes |
| Migration window | < 10 min | including verification |

## Throughput targets

| Surface | Peak RPS | Sustained RPS |
|---|---|---|
| API (authenticated) | 500 | 100 |
| API (public REST `/v1`) | 100 | 20 |
| Webhooks inbound | 50 | 10 |
| LiveKit voice sessions concurrent | 200 | 50 |

## Availability / SLOs

| Service | SLO | Window | Error budget |
|---|---|---|---|
| Web app | 99.9% | 30d | 43 min |
| API | 99.95% | 30d | 22 min |
| Webhooks delivery | 99.5% | 30d | 3.6 h |
| Email delivery | 99% | 30d | 7.2 h |

## Recovery objectives

| Metric | Target |
|---|---|
| RPO (data loss) | 5 min — Postgres point-in-time recovery |
| RTO (downtime) | 30 min — Vercel/SST redeploy + DB failover |
| Backup retention | 30 days |
| DR test cadence | Quarterly |

## Scaling assumptions

### Year 1
- Orgs: 100
- Users per org (avg): 5
- Entities per org (avg): 1000
- Daily active sessions: 200
- Concurrent voice sessions peak: 20

### Year 3
- Orgs: 5000
- Users per org (avg): 10
- Entities per org (avg): 5000
- Daily active sessions: 10000
- Concurrent voice sessions peak: 500

### Bottleneck plan
- DB: read replicas at 5000 orgs
- LiveKit: regional SFU per region after 500 concurrent
- Vercel: per-app project + edge caching

## Multi-region

- **Primary:** ap-south-1 (Mumbai)
- **Secondary (future):** us-east-1 (NoVA)
- **Strategy:** read-replica per region from Year 2; full active-active not planned

## On-call

- **Rotation:** 1-week shifts (3-person team)
- **Tools:** PagerDuty + Slack
- **Escalation:** P1 → primary (5 min) → secondary (15 min) → manager (30 min)
- **Runbooks:** `docs/project/runbooks/` (one per common incident)

## Cost budgets

| Service | Monthly budget |
|---|---|
| Vercel | $200 |
| Neon | $100 |
| Upstash (Redis + QStash + Workflow) | $50 |
| LiveKit (or self-hosted) | $200 |
| AI SDK Gateway (LLM calls) | $300 |
| ZeptoMail | $30 |
| Sentry | $50 |
| **Total target** | **$930** |

Alerts: 75% of budget → Slack; 100% → PagerDuty.

## Security

| Control | Implementation |
|---|---|
| Encryption at rest | Postgres native, S3 SSE, secrets via SST/Secrets Manager |
| Encryption in transit | TLS 1.3 minimum |
| Key rotation | 90d cadence |
| WAF | Cloudflare + Vercel |
| Rate limiting | `@upstash/ratelimit` sliding window |
| DDoS | Cloudflare + Vercel + AWS Shield Standard |
| SAST | GitHub CodeQL on PRs |
| Dependency scan | Dependabot weekly |
| Secrets scan | gitleaks pre-commit + CI |
| PII access log | DB-level + application-level |

## Accessibility

- WCAG 2.2 AA on all customer-facing surfaces
- Keyboard navigation end-to-end
- Screen reader smoke test per release
- Color contrast verified in both themes

## Browser / device support

- **Web**: Chrome / Firefox / Safari / Edge — last 2 major
- **Mobile web**: iOS Safari 15+ / Android Chrome 100+
- **Native**: iOS 16+ / Android 10+

## Internationalization (if applicable)

- Launch languages: <list>
- Adding language: lead time 2 weeks (translator + QA)
- Fallback: English

## Data residency

- India users: ap-south-1
- EU users (future): eu-west-1 with separate Postgres cluster
- Cross-region replication: opt-in per org

## Compliance

See [compliance-pii-inventory.md](./compliance-pii-inventory.md).

## Related
- **Architecture overview:** [architecture-overview.md](../architecture-overview.md)
- **Observability architecture:** [observability-architecture.md](./observability-architecture.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

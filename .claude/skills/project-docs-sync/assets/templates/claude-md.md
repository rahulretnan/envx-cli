# <Project Name>

> Updated: YYYY-MM-DD · Version 1.0
> See `docs/project/` for full documentation. This file is Claude Code's
> entry point — keep it accurate.

## What this is
<One paragraph describing the product.>

## Stack provenance
- **Archetype:** <A: Better-T-Stack | B: Hasura+Amplify | C: Vite SPA>
- **Scaffold:** `pnpm create better-t-stack@latest` (or `pnpm dlx shadcn@latest init` for C, custom for B)
- **Origin file:** `bts.jsonc` (Archetype A) / `amplify_outputs.json` (B) / `package.json` (C)
- **Deviations from default:** <list>
- **Why this stack:** <1-2 sentences>

## Tech stack

| Category | Technology |
|---|---|
| Frontend | <Next.js 16 / Vite + React 19 / Expo SDK 55> |
| API | <oRPC / Hasura / REST / AppSync> |
| DB | <Neon Postgres / self-hosted Postgres + PostGIS> |
| ORM | <Drizzle / Hasura> |
| Auth | <Better Auth + plugins / Cognito + Amplify Gen 2> |
| Infra | <SST + Vercel / Amplify Gen 2 + Vercel> |
| Async | <Upstash QStash + Workflow / SQS + EventBridge> |
| Email | ZeptoMail |
| Payments | <Dodopayments / Stripe> |
| Observability | Sentry + PostHog |

## Region & profile
- AWS profile: `<Datahase>`
- Region: `ap-south-1` (India market) / `eu-west-1` / etc.
- Vercel team: `<team>`

## Repo layout
```
apps/<list>
packages/<list>
services/<list — if Hasura>
docker/<list — if applicable>
docs/project/         ← READ FIRST
```

## User roles
| Role | Description | Can Login | Notes |
|---|---|---|---|
| Platform Admin | Internal staff | Yes | Separate auth instance |
| Org Owner | Created the org | Yes | Full org access |
| <Role> | <description> | <Yes/No> | |

Permission matrix: `docs/project/shared/rbac-matrix.md`
Source of truth: `packages/auth/src/permissions.ts`

## Core modules
| Module | Purpose | Doc |
|---|---|---|
| Identity | Auth, settings, profile | [→](docs/project/modules/identity/module.md) |
| Tenants | Occupants, rooms, beds | [→](docs/project/modules/tenants/module.md) |
| Money | Rent, payments, expenses | [→](docs/project/modules/money/module.md) |
| Team | Wardens, invitations | [→](docs/project/modules/team/module.md) |
| Operations | Dashboard, reports | [→](docs/project/modules/operations/module.md) |
| Platform | Settings, support, audit | [→](docs/project/modules/platform/module.md) |

## Documentation map
- **Architecture overview:** `docs/project/architecture-overview.md` (9 project-wide diagrams)
- **Tech stack details:** `docs/project/tech-stack.md`
- **Design guidelines:** `docs/project/design-guidelines.md`
- **Glossary:** `docs/project/glossary.md`
- **Decisions (ADRs):** `docs/project/decisions.md`
- **RBAC matrix:** `docs/project/shared/rbac-matrix.md`
- **Compliance / PII:** `docs/project/shared/compliance-pii-inventory.md`
- **NFR / SLOs:** `docs/project/shared/nfr.md`
- **Webhooks (in/out):** `docs/project/shared/webhooks-{incoming,outgoing}.md`
- **Async architecture:** `docs/project/shared/async-architecture.md`
- **Change history:** `docs/project/changes-log.md` ← every doc change logged

## Per-module structure
Each module folder contains:
- `module.md` — page inventory + action × role matrix + Mermaid diagrams
- `features/feature-*.md` — wiring (sequence diagrams + file paths)
- `api/api-*.md` — procedure / endpoint specs
- `schema/schema-*.md` — tables + indexes + Drizzle/Hasura source
- `workflows/workflow-*.md` — swimlane diagrams + happy/failure paths
- `state-machines/status-*.md` — state diagrams (if stateful entity)
- `async-jobs/job-*.md` — cron / queue specs
- `observability.md` — telemetry events + dashboards + alerts
- `compliance.md` — PII fields + retention + deletion (if applicable)
- `test-plan.md` — critical paths + tooling

## Anti-patterns to avoid
- Never `db:push` — always migration-based
- Never store raw passwords / API keys / Aadhaar
- Never put PII in URL query strings
- Never expose oRPC procedures to integrators — use REST `/api/v1/*`
- Never combine LiveKit voice worker with CRUD API in one process
- See full list: `docs/project/_templates/08-anti-patterns.md`

## Change protocol
Any change to features / APIs / schema / roles MUST go through the change
protocol in `docs/project/_templates/11-change-tracking.md`:
1. Identify affected docs
2. Confirm with user
3. Rewrite affected files (version bump + local changelog row)
4. Append pointer to `docs/project/changes-log.md`
5. Re-verify cross-references

## Where to start
- New feature: read the affected module's `module.md` first
- New module: see `docs/project/_templates/05-module-decomposition.md`
- Audit: see `docs/project/_templates/09-verification-checklist.md`

## Supporting skills
See `skills-lock.json` for installed support skills.

## Open questions
- [ ] <unresolved decision>

## Changelog
| Version | Date | Changes |
|---|---|---|
| 1.0 | YYYY-MM-DD | Initial CLAUDE.md |

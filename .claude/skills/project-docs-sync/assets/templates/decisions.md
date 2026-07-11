---
Status: Living index
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
---

# Decisions Index (ADRs)

Architecture Decision Records. Each is a short doc in `adr/<NNNN>-<slug>.md`
using the template in `_templates/adr.md`.

## Active

| # | Title | Date | Status | Tags |
|---|---|---|---|---|
| 0001 | Stack archetype: Better-T-Stack | YYYY-MM-DD | Accepted | archetype |
| 0002 | Auth: Better Auth + Google OAuth only | YYYY-MM-DD | Accepted | auth |
| 0003 | DB: Neon serverless Postgres | YYYY-MM-DD | Accepted | data |
| 0004 | Multi-tenancy: per-org via Better Auth `organization` plugin | YYYY-MM-DD | Accepted | tenancy |
| 0005 | Async: Upstash QStash + Workflow over SQS | YYYY-MM-DD | Accepted | async |
| 0006 | Payments: Dodopayments over Stripe | YYYY-MM-DD | Accepted | payments |
| 0007 | India region: ap-south-1 | YYYY-MM-DD | Accepted | infra |
| 0008 | Env management: envx-cli + GPG-encrypted files | YYYY-MM-DD | Accepted | infra |
| 0009 | Admin separation: two Better Auth instances + X-Auth-Source | YYYY-MM-DD | Accepted | auth |
| 0010 | Voice transport: self-hosted LiveKit SFU in Mumbai | YYYY-MM-DD | Accepted | infra |

## Superseded

| # | Title | Superseded by |
|---|---|---|

## Proposed

| # | Title | Open question |
|---|---|---|

## Adding an ADR

1. Copy `_templates/adr.md` to `adr/NNNN-<slug>.md` (next sequential number)
2. Fill in Context / Decision / Alternatives / Consequences
3. Add a row to this index
4. Reference the ADR from any doc that depends on the decision
5. Update relevant module / shared docs that this decision affects
6. Log in `changes-log.md` if generation already happened

# 01 — Discovery Questions (one at a time, adaptive)

Rules in force throughout:

- **ONE question at a time.** Never batch.
- **Recommend, don't just list.** Put your recommended option first, append
  `(Recommended)`. Always give a one-sentence reason. Always give a "don't
  pick this if…" caveat for the alternatives.
- **Push back on vague answers** (see `12-push-back-triggers.md`).
- **Fire proactive suggestions** when a trigger matches `07-proactive-prompts.md`.
- **Adapt the next question** based on the previous answer. Skip irrelevant
  questions silently.

This file is organized by section. Each section corresponds to a phase in
`00-orchestration.md`. Each section is an ordered question list — ask in order,
but skip questions that earlier answers made irrelevant.

---

## §1 — Project classification

### Q1.1 — What are we designing today?
Open-ended. One line. Don't ask anything else yet.

### Q1.2 — Best fit for the project type
Recommend based on Q1.1. If you can confidently infer (e.g. "an Aadhaar-based
hostel rent collection app" → ERP/SaaS), say what you inferred and ask for
confirmation:

> "Sounds like a B2B SaaS with India-market specifics. Confirm — or did I get
> the type wrong?"

Otherwise present the options (one will be `(Recommended)` based on your read):
- B2B SaaS (subscription, orgs, billing)
- B2C / Consumer
- Internal admin tool
- Mobile-first consumer app
- API product (SDK / integrators primary)
- AI agent (chat / voice / autonomous)
- Marketplace (two-sided)
- ERP / heavy CRUD
- Hybrid (specify which two)

---

## §2 — Business context

### Q2.1 — Target user persona
Push for specifics: "small hostel owners with 1-3 properties, age 35-55, low
tech comfort" not "businesses". If user gives a vague persona, push back:
"Can you describe one specific person who'd buy this — name, role, daily job?"

### Q2.2 — Geography / launch markets
Required. Trigger India modifier if mentioned. If "global", force first 3
markets: "Which 3 markets are you launching in first? Global is fine eventually
but early-stage focus matters for stack picks (region, payment rails, comms)."

### Q2.3 — Regulatory / compliance constraints
Probe based on geography. If India: DPDP, IT Act, GST. If EU: GDPR, DPA. If US:
state-specific (CCPA, HIPAA if health). If healthcare/finance, drill harder.
If user says "none", push back: "Even basic apps need to think about PII —
will you store names, emails, phone numbers, photos? Anything more sensitive?"

### Q2.4 — Realistic scale at 6 months
Specific numbers. If "millions" — push back: "Be realistic for month 6 —
hundreds, thousands, tens-of-thousands of MAU?" Use the answer to size the
stack — millions of MAU pushes toward Hasura+Postgres-with-replicas or away
from edge runtime.

### Q2.5 — Pricing model
- Free / open source
- Subscription (tiered)
- Subscription (per-seat)
- Usage / credit-based (Recommended for AI workloads)
- One-time
- Marketplace cut

If subscription + India → trigger Dodopayments recommendation.
If usage-based → trigger credit-metering middleware pattern.

---

## §3 — Stack archetype

Run the decision tree in `02-stack-selection.md` §7.5 verbatim, one question
at a time. After landing on an archetype, RECAP with reasoning before asking
the user to confirm. See example narration in `02-stack-selection.md`.

After confirmation, ask the **archetype deltas** — only the questions that
matter for the chosen archetype:

### If Archetype A (Better-T-Stack):
- DB driver: Neon serverless `(Recommended)` vs postgres-js (Bun runtime / self-host)
- Frontend mix: dashboard only / + marketing / + admin (separate scope) / + mobile
- API surface: oRPC only `(Recommended)` / + auto-OpenAPI / + REST `/v1` for SDK
- Better Auth plugins to enable (multi-select with rationale per plugin)
- Editor needs: Plate.js workspace package? (only if rich-text is core)

### If Archetype B (Hasura + Amplify):
- Hasura hosting: self-hosted (Docker + Caddy) `(Recommended for control)` vs Hasura Cloud
- Postgres: Neon / RDS / self-hosted-with-PostGIS
- AppSync usage: pure RPC wrappers over Lambda `(Recommended)` vs Amplify Data as data layer
- Vector DB: Milvus (heavy) / S3 Vectors via Mastra (light) / none
- Codegen targets: Apollo hooks + graphql-request SDK `(Recommended)` vs only frontend hooks

### If Archetype C (Vite SPA):
- Routing: TanStack Router `(Recommended)` vs React Router
- Auth: none (shared password) / SSO / OAuth
- Backend: existing API / new Hono+Bun service / serverless functions

---

## §4 — Auth & tenancy & roles

### Q4.1 — Auth provider
Recommend based on archetype. Don't just list.

### Q4.2 — Auth methods
Multi-select. Recommend OAuth-only for greenfield (reduces edge cases by ~30%).
If user says email/password, fire proactive suggestion: password reset,
breach check, captcha, re-auth on change.

### Q4.3 — Tenancy axis
**Reject "multi-tenant" alone.** Force one of:
- Per-user (single-tenant, each user is isolated)
- Per-org / workspace (Recommended for B2B SaaS)
- Per-team (sub-org grouping)
- Per-customer-account (legacy ERP style)
- Hybrid (explain crossing rules)

### Q4.4 — Cross-tenant rules
"What crosses tenant boundaries?"
- Platform admins (impersonation? read-only?)
- Cross-org analytics
- Shared resources (e.g. global marketplace listings)
- Billing (does parent org pay for child orgs?)

### Q4.5 — Admin app
Separate admin app yes/no? If yes:
- Same cookie scope (subdomain split) `(Recommended for askshelf pattern)`
- Same auth, different role
- Fully separate auth (separate Better Auth instance)

### Q4.6 — Impersonation
Default-recommended for B2B SaaS. If yes, fire proactive suggestion: signed
JWT cookie pattern, audit log every impersonate-start, impersonate-stop,
impersonate-action.

### Q4.7 — MFA
For payments / PII / India compliance → recommend yes (TOTP minimum). For
internal tools → optional.

### Q4.8 — Session lifetime + refresh strategy
Default 7d session + sliding refresh.

### Q4.9 — Roles
List every role. For each: can-login yes/no? Tier (platform / org / team)?

### Q4.10 — RBAC matrix draft
Load `10-rbac-matrix-guide.md`. Force user to sketch role × top-level-resource
× action grid before exiting Phase 4.

---

## §5 — Module inventory

Done in `05-module-decomposition.md`.

---

## §6 — Per-module deep dive

Done in `05-module-decomposition.md`. The 20-step loop runs here.

---

## §7 — Async & scheduling

Only ask if relevant (i.e. project has at least one of: subscriptions,
notifications, AI pipelines, integrations, scheduled reports).

### Q7.1 — Job kinds (multi-select)
- Fire-and-forget jobs from API (Upstash QStash `(Rec for BTS)` / SQS `(Rec for Amplify)`)
- Multi-step pipeline with retries (Upstash Workflow `(Rec)`)
- Single daily batch (SST Cron / Hasura cron_triggers)
- Per-row scheduled side-effects (EventBridge Scheduler `(Rec)`)
- S3 upload triggers

### Q7.2 — Idempotency
Always recommend Redis `SET NX EX` with key derived from input hash. Walk user
through why.

### Q7.3 — DLQ + alerting
Always required for any queue. Recommend Sentry / SNS-to-Slack.

---

## §8 — AI / Realtime / Voice

Only ask if relevant.

### Q8.1 — AI surface area
- None
- LLM streaming in editor (AI SDK v6 + Gateway `(Rec)`)
- Multi-step pipeline (AI SDK + Upstash Workflow)
- Structured outputs (generateObject + Zod)
- Agent (Mastra)
- Voice — single-turn (Gemini 2.5 Live `(Rec)`)
- Voice — conversational (ElevenLabs + Mastra `(Rec)`)
- Embeddings + vector search

### Q8.2 — Cost guard / credit metering
Required for any AI surface beyond toy. Recommend per-call middleware.

### Q8.3 — Prompt-injection mitigation
For any user-provided text fed to LLM. Recommend explicit sanitisation block.

### Q8.4 — Eval suite
Recommend small golden-set evals from day 1. Skipping → tech debt.

---

## §9 — Distribution

### Q9.1 — Frontends needed (multi-select)
- Dashboard (the product)
- Admin (separate cookie scope)
- Marketing site
- Docs portal (Fumadocs `(Rec for SDK products)`)
- Mobile (Expo + Uniwind `(Rec)`)
- PWA
- Embeddable widget
- Published SDK (`@org/sdk` + `@org/react` + demo app `(Rec for partner products)`)

### Q9.2 — Mobile push (if mobile)
- Direct FCM + APNs via firebase-admin `(Rec)`
- Expo Push (only if <10k DAU receiving pushes)

### Q9.3 — Update strategy (if mobile)
- EAS Update OTA `(Rec)`
- Store-only

---

## §10 — Compliance & PII

Always required. Never skip.

### Q10.1 — PII fields
"List every field that's PII: name, email, phone, photo, ID number, location,
health data, financial data. Be exhaustive — anything that identifies a person."

### Q10.2 — Retention rules
Per-category retention. Default 7 years for financial, 90 days for analytics,
indefinite for account-active.

### Q10.3 — Deletion path
"Right to be forgotten" — for each PII field, who deletes, when, what cascades.

### Q10.4 — Encryption at rest
Recommend pgcrypto for sensitive fields, S3 SSE for files.

### Q10.5 — Access log
Who accessed which PII when? Required for India DPDP / EU GDPR.

---

## §11 — Non-functional requirements

### Q11.1 — Latency budget
p50/p95 in ms per route class. If user says "fast", push back for numbers.

### Q11.2 — Throughput target
Requests/s peak.

### Q11.3 — RPO / RTO
Recovery point / time objectives.

### Q11.4 — Multi-region
Read replicas? Active-active? Default no, push back if user said "global".

### Q11.5 — On-call
Solo / team / no on-call. Influences alerting strategy.

---

## §12 — Integrations

### Q12.1 — Inbound (OAuth providers)
Google / Apple / Microsoft / GitHub / Zoho / Slack / custom OIDC.

### Q12.2 — Outbound services
Sentry (Rec — never skip), PostHog / Mixpanel / Amplitude for analytics,
Datadog / Axiom for logs, Resend / Postmark / ZeptoMail for email, Twilio /
Meta WhatsApp Cloud API for SMS/WhatsApp.

### Q12.3 — Payments
Dodopayments `(Rec for India SaaS)`, Razorpay, Stripe, Paddle, LemonSqueezy.

### Q12.4 — Webhooks (incoming)
List every gateway/integration that posts to you. For each: signature scheme,
idempotency strategy.

### Q12.5 — Webhooks (outgoing)
List every customer-facing event you'll emit. Trigger outbound-webhook spec.

---

## §13 — Confirmation pass

See `00-orchestration.md` Phase 8 for the recap format.

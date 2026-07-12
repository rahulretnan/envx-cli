# 02 — Stack Selection

This file is the skill's stack-architect brain. It encodes a decision tree,
a requirement-to-archetype framework, trigger signals from user answers, and
"when NOT to use" anti-cases.

All recommendations are evidence-backed by analysis of six real production
projects: askshelf, weesli, hostelsync, wrytze, rankze, tiaime.

## The three archetypes

### Archetype A — Better-T-Stack (BTS)

```
Next.js 16 + React 19 + React Compiler
   + shadcn (base-lyra / @base-ui/react) + Tailwind v4
   + TanStack Query + TanStack Form
oRPC (RPCHandler + OpenAPIHandler on same /api/rpc route)
Drizzle ORM + Postgres (Neon serverless OR postgres-js)
Better Auth (organization, admin, apiKey, bearer, dodopayments, ...)
SST v3 on AWS ap-south-1 (S3 + CloudFront + λ + Cron)
Vercel for Next apps
Upstash QStash + Upstash Workflow + Upstash Redis
ZeptoMail + React Email templates
Dodopayments
envx-cli with .env.production.gpg
pnpm workspace catalog:
```

### Archetype B — Hasura + Amplify Hybrid

```
Vite SPA (TanStack Router) | Next.js 16 | Expo
   + shadcn + Radix + Tailwind v4 + Apollo Client + Zustand
Hasura GraphQL Engine (Docker + Caddy) — data API
   + Cognito JWT validated against JWKS
   + Hasura Actions → API Gateway → Lambdas
Postgres (Neon | RDS | self-hosted w/ PostGIS)
   + optional Milvus | S3 Vectors
Amplify Gen 2 (Cognito + S3 + CloudFront + Lambdas + Custom CDK)
Dual codegen (Apollo hooks + graphql-request SDK)
```

### Archetype C — Vite SPA (lightweight)

```
Vite + React 19 + TanStack Router + Tailwind v4 + shadcn/ui + Zustand
Backend: existing API | Hono+Bun service | serverless functions
No Better Auth / Hasura unless usage warrants it
```

## §7.1 — Decision framework: requirements → archetype

Run this through during Phase 3. Each row PULLS toward an archetype. If
signals conflict, call it out and ask the user to prioritise.

| Requirement signal | Pulls toward | Reason |
|---|---|---|
| Greenfield, schema in your head | A | Drizzle migrations cheapest for iteration |
| Schema already designed (DBML, ERD, legacy DB) | B | Hasura auto-generates the API |
| GraphQL subscriptions for primary UI | B | Hasura subscriptions free |
| Multi-tenant via Organizations | A | Better Auth `organization` plugin built for it |
| Multi-tenant via row-level JWT-claim filtering | B | Hasura RLS is its strongest feature |
| Voice / conversational AI primary | A + LiveKit + Mastra/ElevenLabs | Two-server topology fits BTS |
| AI content pipeline w/ multi-step retries | A + Upstash Workflow + AI SDK v6 | wrytze pattern |
| Mobile-first consumer app | A (mobile-only or hybrid) | Expo + bearer plugin + same oRPC |
| Heavy CRUD ERP w/ rich admin | B | Hasura mutations + Apollo subscriptions |
| Customer-embeddable SDK | A + REST `/v1` + Better Auth apiKey | wrytze pattern |
| GraphQL for integrators | B | Publish Hasura |
| Geospatial primary | B (Postgres + PostGIS) | weesli — Neon lacks PostGIS |
| Vector search heavy | B + Milvus | rankze pattern |
| Vector search light | A + S3 Vectors via Mastra | tiaime pattern |
| Subscriptions billing in India | A + Better Auth dodopayments plugin | hostelsync/wrytze |
| Usage-based / credit-metered billing | B + credits-guard middleware | rankze pattern |
| Existing AWS-heavy team | B | Amplify keeps AWS-native |
| Bun runtime preferred | A variant (postgres-js + Hono on Bun) | askshelf |
| Edge-runtime requirement | A | Hasura needs long-lived connection |
| Docs portal alongside | A + Fumadocs | wrytze |
| Internal tool w/ <20 users | C | A/B both overkill |
| Compliance-heavy w/ PII masking in DB | B + Postgres Anonymizer | tiaime direction |

## §7.2 — Trigger signals from discovery answers

Concrete phrases in answers → what the skill should do:

| User says… | Skill action |
|---|---|
| "We have a DBML spec already" | Lock to B; open `04-domain-recipes.md` → ERP recipe |
| "Live updates on a leaderboard / queue / table" | Recommend B (Hasura subs) or A + Pusher/Ably |
| "Voice / talk to the app" | A + LiveKit + (Gemini Live for single-turn / ElevenLabs+Mastra for multi-turn) |
| "AI writes/generates X" | A + Upstash Workflow + AI SDK v6 + per-phase models (wrytze recipe) |
| "Recruiters / hiring / ranking candidates" | B + Milvus + Vertex AI (rankze recipe) |
| "Delivery / driver / route" | B + PostGIS (weesli recipe) |
| "Family / kids / household / parenting" | Probe age-floor; minors → B + privacy-preserving RLS (tiaime) |
| "Hostel / PG / property / rent / tenant management" | A + dodopayments + India recipe (hostelsync) |
| "Marketplace" / "two-sided" | Probe which side has harder problem; choose by that |
| "Internal tool — fixed list of users" | Archetype C |
| "We're already on Supabase / Firebase" | Honour existing investment; produce docs in that flavour |
| "Admin panel for support" | Two-instance Better Auth + X-Auth-Source header |
| "Bulk operations" / "CSV import" | QStash worker Lambda + signed URL upload + report email |
| "Recurring billing with tiers" | Better Auth dodopayments + subscribedProcedure middleware + trial logic |
| "WhatsApp / SMS to customers" | Meta WhatsApp Cloud API + template approval flow + Twilio fallback |
| "Aadhaar / KYC / Indian ID" | First-class verification package + UIDAI cert + encryption at rest (hostelsync) |
| "Need an SDK customers install" | Published `@org/sdk` + `@org/react` + demo app + Fumadocs |
| "Should work offline" | Probe scope: read-only → TanStack Query + MMKV; write-too → CRDT design |
| "Notifications / reminders" | User-specific timing → EventBridge Scheduler per-row; global daily → SST Cron |

## §7.3 — Decision tree the skill walks (one question at a time)

Narrate each answer. Don't ask all at once — adapt based on prior answers.

```
Q1: Internal tool with <20 fixed users?
  YES → Archetype C. STOP.
  NO  → continue

Q2: Existing schema (DBML, ERD, legacy DB)?
  YES → bias B
  NO  → bias A

Q3: GraphQL subscriptions as first-class UI feature?
  YES → strong B
  NO  → unchanged

Q4: Customer-embeddable SDK or partner integration product?
  YES → strong A (+ REST /v1 + apiKey plugin)
  NO  → unchanged

Q5: Team has Amplify Gen 2 experience?
  YES → make B viable
  NO  → bias A

Q6: Voice / conversational AI primary?
  YES → A + LiveKit + (Gemini Live | ElevenLabs+Mastra). STOP after asking which voice flavour.
  NO  → continue

Q7: Mobile-first?
  YES → A + Expo + Uniwind regardless of backend pick
  NO  → continue

Q8: Resolve A vs B from accumulated bias:
  Bias A → A
  Bias B → B
  Tie    → default A (faster to ship, easier to swap later)

Q9: Add modifiers (multi-select):
  India market → +Dodopayments +WhatsApp +ZeptoMail +ap-south-1 +envx-cli
  Vector search heavy → +Milvus
  Vector search light → +S3 Vectors via Mastra
  Geospatial → +PostGIS (forces B if Neon was planned)
  AI workflows → +Upstash Workflow + AI SDK v6 + AI Gateway + per-phase models
  Real-time presence → +LiveKit data channels OR Pusher/Ably
  Published SDK → +@org/sdk + @org/react + demo app + Fumadocs

Q10: Confirmation
```

### Example narration after Q10

> Based on your answers — B2B SaaS, no existing schema, India market, no
> realtime subscriptions, customer-embeddable SDK planned, mobile app
> planned, no voice — I'm landing on:
>
> **Archetype A (Better-T-Stack)** with modifiers:
> - Published SDK (`@org/sdk` + `@org/react` + demo + Fumadocs)
> - Expo mobile app
> - India SaaS pack (Dodopayments + WhatsApp + ZeptoMail + ap-south-1 + envx-cli)
>
> Reasoning: greenfield + SDK requirement is the strongest signal — REST `/v1`
> with Better Auth `apiKey` is what integrators consume. Mobile is well-served
> by Expo + oRPC client. No real-time means no Hasura tax.
>
> One anti-pattern to flag: **don't expose oRPC routes to integrators** — they
> expect REST. Plan `/api/v1/*` as a separate, intentionally-stable contract
> from day one (versioning + deprecation policy).
>
> Want to go with this, or push back on any of it?

## §7.4 — "When NOT to use" — anti-recipes

### Don't pick Archetype A (BTS) when…
- DBML-first schema that changes often → use B
- Need GraphQL subscriptions as primary UI → use B
- Team has deep AWS-native expertise / wants Amplify ecosystem → use B
- Hundreds of complex JWT-claim-driven row rules → Hasura's RLS is better
- Need PostGIS primary
- Internal tool with <10 users → use C

### Don't pick Archetype B (Hasura+Amplify) when…
- Iterating schema weekly in a new product → Drizzle is faster
- Edge-runtime API responses needed → Hasura requires long-lived connection
- Publishing SDK to customers → REST is what integrators want, not GraphQL
- Solo dev / small team without prior Amplify experience → CFN nested-stack
  debugging eats weeks
- Business logic is mostly in resolvers (not in CRUD) → escape-to-Lambda
  pattern slower than oRPC
- Deeply customised auth (impersonation, multi-instance, custom session shapes)
  → Better Auth more flexible than Cognito

### Don't pick Archetype C (Vite SPA) when…
- Need SEO → Next.js
- Public marketing site → Next.js
- PWA with offline writes → can be done but Next + next-pwa more standard

### Don't pick LiveKit Cloud when…
- India primary → self-host SFU in Mumbai (askshelf)

### Don't pick Mastra when…
- Only single-turn LLM calls → AI SDK v6 alone is simpler
- Don't need agent memory → Mastra's value is the Memory primitive

### Don't pick Dodopayments when…
- US-only / EU-only → Stripe more mature outside India

### Don't pick Expo Push when…
- >10k DAU receiving pushes → direct FCM/APNs via firebase-admin scales better

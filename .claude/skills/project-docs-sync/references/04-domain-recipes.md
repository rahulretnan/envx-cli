# 04 — Domain Recipes

Per-domain mini-recipes. Use after archetype is chosen to layer on
domain-specific modifiers. Each recipe = Pick / Why / Don't.

---

## India-Market B2B SaaS (askshelf / hostelsync / wrytze pattern)

**Pick:** Archetype A. Next 16 + oRPC + Drizzle + Neon + Better Auth
(`organization`, `admin`, `apiKey`, `dodopayments`) + SST (ap-south-1) +
Vercel + Upstash + ZeptoMail + WhatsApp Cloud API + envx-cli.

**Why:** India payment rails (Dodopayments), India-friendly latency
(ap-south-1), India comms (WhatsApp templates) all have plug-and-play
integrations. Better Auth `organization` + `subscribedProcedure` middleware
gives trial-or-subscription gating in one file.

**Don't:** Don't pick Stripe (worse INR experience), don't pick Cognito
(you don't need it; Cognito IAM wastes a week), don't go Hasura unless
schema is already DBML.

---

## AI Content Pipeline (wrytze pattern)

**Pick:** Archetype A + **Upstash Workflow** + **AI SDK v6 + AI Gateway** +
**per-phase model selection** + **Plate.js as workspace package** (only if
rich-text editor is core) + **Published SDK** for partner consumption.

**Why:** Multi-step LLM jobs need durable orchestration (Workflow),
provider-agnostic model selection (Gateway), and per-phase quality vs cost
tuning (different model per step). Plate.js as its own package isolates
~40 plugins from the dashboard build.

**Don't:** Don't build orchestration in-app — Workflow gives retries,
checkpoints, observability for free. Don't pick Stripe (India). Don't
hard-code a single LLM provider — AI Gateway saves you when one is down.

---

## AI Voice Agent (askshelf / tiaime patterns)

**Pick:** Archetype A + **LiveKit (self-hosted SFU in-region for India,
Cloud elsewhere)** + one of:

- **Single-turn voice + tools → Gemini 2.5 Live** (askshelf pattern). Native
  audio, ~70 languages, search grounding, fastest TTFB.
- **Multi-turn conversational + memory + tools → ElevenLabs Conversational
  AI + Mastra Memory + per-tool Lambdas** (tiaime pattern). Better persona
  control, "Custom LLM" seam for privacy.

**Architecture:** Two-server topology — persistent CRUD server
(Hono/Bun on Railway) + persistent voice worker (LiveKit Agents Worker on
Lightsail/Fly) — **never combine them**. Voice token minted by CRUD server
with `RoomAgentDispatch` metadata.

**Don't:** Don't run voice on Vercel (cold starts kill turn-taking).
Don't pick a generic WebRTC SDK (LiveKit is the only one with first-class
server agents). Don't store raw transcripts without PII masking.

---

## Mobile-First Consumer App (tiaime mobile / hostelsync mobile)

**Pick:** Expo SDK 55 + **Uniwind 1.6 + Tailwind v4** (newer; replaces
NativeWind) + Zustand + TanStack Query (persisted via MMKV) + Apollo or
oRPC client + **direct FCM + APNs via `firebase-admin`** (skip Expo Push) +
EAS Build + Changesets for releases.

**Why:** Hermes is mature; Tailwind via Uniwind is the cleanest RN styling
story; MMKV-backed TanStack Query persistence gives offline reads for free;
direct FCM avoids the Expo Push proxy when you outgrow the free tier.

**Don't:** Don't use Expo Push at scale, don't pick NativeWind for new
projects (Uniwind is the successor), don't use `Intl` for timezone math on
Android (broken in Hermes — use spacetime).

---

## Internal Admin / Lightweight SPA

**Pick:** Archetype C — Vite + React 19 + TanStack Router + Tailwind v4 +
shadcn/ui + Zustand. Backend: consume existing API OR pair with a single
Hono/Bun service.

**Why:** You don't need Next.js for an internal tool with fixed users.
SPA is faster to ship and debug.

**Don't:** Don't add Better Auth if you have <10 users — start with a shared
password or your SSO provider's OIDC.

---

## ERP / Heavy CRUD with Subscriptions UI (weesli)

**Pick:** Archetype B. Vite + TanStack Router (admin) + Apollo Client +
GraphQL-WS subscriptions + Hasura (Docker, Caddy) + Postgres (PostGIS if
geo) + Cognito via Amplify Gen 2 + custom HTTP API Gateway for Hasura
Actions → Lambdas + dual codegen (Apollo hooks + graphql-request SDK).

**Why:** ERP entities are highly relational, change shape often, benefit
from auto-generated GraphQL. Subscriptions give ops teams live updates
without polling. Hasura permissions + Cognito JWT claims = cleanest RBAC.

**Don't:** Don't expose Hasura admin secret in Lambda envs (use Secrets
Manager). Don't put business logic in Hasura computed fields — escape to
Lambda via Actions. Don't skip dual codegen — manual SDKs always drift.

---

## AI SaaS — Document Upload + Ranking (rankze)

**Pick:** Archetype B + **Milvus** (Zilliz) + **Vertex AI primary, Bedrock
fallback** + **SQS + custom Lambda router** + **Dodopayments** (subscription)
+ **credits-guard middleware** on every AI call + **5 OAuth integrations**
(Google/Microsoft/Zoho/SMTP/GitHub) using the same connect/callback/disconnect
Lambda triplet.

**Why:** Document extraction + ranking needs heavy vector search; Milvus's
RRF reranking on dense+sparse is the right tool. Vertex AI gives best
price/perf on Gemini; Bedrock is your fallback for IAM-consolidated workloads.

**Don't:** Don't try DynamoDB for the relational core (rankze moved off —
Postgres+Hasura is the answer). Don't gate AI calls in the UI — always gate
in Lambda via credits-guard.

---

## Marketplace / Two-Sided Platform

**Pick:** Default Archetype A unless schema is already designed (then B).
Add: **separate apps for each side** (`apps/buyer`, `apps/seller`),
**separate Better Auth instances** if sides have very different auth
requirements, **transactional outbox pattern** for cross-side notifications,
**Stripe Connect or Razorpay Route** for payouts.

**Don't:** Don't share a single dashboard between sides — they evolve
differently. Don't model "user is buyer OR seller" — model "user has
buyer_profile and/or seller_profile" so a user can be both.

---

## Multi-Tenant B2B with Org-Switcher

**Pick:** Archetype A. Better Auth `organization` plugin. Every API
procedure reads `activeOrganizationId` from session and scopes queries.
Add an org-switcher UI calling `setActiveOrganization`. Use `admin` plugin
for platform access (separate cookie scope via X-Auth-Source header).

**Don't:** Don't roll your own org model — Better Auth's is battle-tested.
Don't pass orgId in URLs as primary scope — JWT claim is safer.

---

## Hostel / PG / Property Management (hostelsync)

**Pick:** Archetype A + **Aadhaar QR verification package** + **Dodopayments**
+ **WhatsApp template messages** + **SST Cron** (single 5-job Lambda for
rent generation, mark-overdue, late-fees, reminders, alerts) + **PWA**
(`next-pwa`) + **6-permission warden RBAC**.

**Don't:** Don't store raw Aadhaar — encrypt at rest, only persist last 4
digits unmasked. Don't try to handle KYC photo without a JPEG2000 decoder.

---

## Delivery / Geospatial (weesli)

**Pick:** Archetype B + **Custom Postgres image with PostGIS** + **areas /
addresses / locations tables with geometry columns** + **delivery-agent PWA**
with offline-first QR scanner.

**Don't:** Don't pick Neon serverless (PostGIS not first-class). Don't
skip area-grouping at the schema level — it ripples into every list query.

---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
---

# Tech Stack

## Stack provenance

| Field | Value |
|---|---|
| Archetype | <A: Better-T-Stack / B: Hasura+Amplify / C: Vite SPA> |
| Scaffold command | `pnpm create better-t-stack@latest` (A) / custom (B) / `pnpm dlx shadcn@latest init` (C) |
| Origin manifest | `bts.jsonc` / `amplify_outputs.json` / `package.json` |
| Deviations from default | <list> |
| Why this stack | <1-2 sentences> |

## Core technologies

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Frontend framework | Next.js | 16.1.x | Server-rendered web app |
| UI runtime | React | 19.2.x | Components |
| UI components | shadcn/ui (base-lyra) | latest | Component primitives via `@base-ui/react` |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Form state | TanStack Form | 1.x | Form handling (NOT React Hook Form) |
| Server state | TanStack Query | 5.x | Async state |
| API protocol | oRPC | 1.13.x | Type-safe RPC |
| API runtime | Hono on Bun (or Node) | 4.8.x | Edge-capable server |
| ORM | Drizzle | 0.45.x | Type-safe Postgres queries |
| Database | Postgres (Neon serverless) | 16 | Primary store |
| Auth | Better Auth | 1.4.x | With plugins: organization, admin, apiKey, dodopayments |
| Cache / rate-limit | Upstash Redis | latest | Per-route caching + sliding window |
| Queues | Upstash QStash | latest | Fire-and-forget jobs |
| Orchestration | Upstash Workflow | latest | Multi-step pipelines |
| Email | ZeptoMail + React Email | latest | Transactional email |
| Payments | Dodopayments | latest | India SaaS billing |
| Messaging | Meta WhatsApp Cloud API | v18 | Customer comms |
| AI | AI SDK v6 + AI Gateway | latest | LLM abstraction |
| Voice (if needed) | LiveKit | 1.3.x | WebRTC SFU |
| Agent (if needed) | Mastra | latest | Memory + tools |
| Observability | Sentry + PostHog | latest | Errors + analytics |
| Infra (AWS) | SST v3 | 3.x | Lambdas, S3, CloudFront, Cron |
| Hosting (Next) | Vercel | latest | Per-app projects |
| Hosting (API) | Railway / Fly | — | Persistent compute |
| Hosting (voice worker) | AWS Lightsail / Fly | — | Persistent compute |
| Monorepo | pnpm + Turborepo | latest / latest | Workspace + caching |
| Env management | envx-cli | latest | GPG-encrypted env files |
| Code quality | Biome / Prettier / ESLint | latest | Lint + format |
| Git hooks | Husky + commitlint + cz-customizable | latest | Conventional commits |
| Release | Changesets + release-it | latest | Versioning |
| Testing | Vitest + Playwright + Maestro | latest | Unit + e2e + mobile |

## Region & account

- **Cloud region:** ap-south-1 (Mumbai) — India market
- **AWS profile:** `Datahase`
- **Vercel team:** `<team>`

## Monorepo layout

```
apps/
  app/                 # main product (Next 16)
  admin/               # internal admin (Next 16, separate cookie)
  web/                 # marketing site (Next 16)
  mobile/              # Expo SDK 55 (if applicable)
  docs/                # Fumadocs (if applicable)
packages/
  api/                 # oRPC routers
  auth/                # Better Auth + plugins
  db/                  # Drizzle schema + Neon client
  email/               # React Email templates
  env/                 # t3-env (/server, /web, /cron)
  cron/                # SST Cron Lambdas
  workers/             # QStash consumer Lambdas
  editor/              # Plate.js (if rich text core)
  config/              # shared tsconfig + eslint
```

## pnpm-workspace.yaml

```yaml
packages: [apps/*, packages/*]
nodeLinker: hoisted
catalog:
  next: "16.1.1"
  react: "19.2.4"
  react-dom: "19.2.4"
  better-auth: "1.4.18"
  "@orpc/server": "1.13.4"
  "@orpc/client": "1.13.4"
  "@orpc/openapi": "1.13.4"
  drizzle-orm: "0.45.1"
  drizzle-kit: "0.31.8"
  zod: "4.3.6"
  hono: "4.8.0"
  typescript: "5.7.0"
```

## Environment variables

```env
# Core
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=http://localhost:3001

# Database
DATABASE_URL=postgres://...

# Better Auth
BETTER_AUTH_SECRET=<32-byte hex>
BETTER_AUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Cache + Queues
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Email
ZEPTOMAIL_TOKEN=
EMAIL_FROM=

# Payments
DODOPAYMENTS_API_KEY=
DODOPAYMENTS_WEBHOOK_SECRET=

# WhatsApp (India)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=

# Observability
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

# AI (if applicable)
AI_GATEWAY_API_KEY=

# Encryption (if India KYC)
AADHAAR_ENCRYPTION_KEY=
```

## Development commands

```bash
# Setup
pnpm install
cp .env.example .env.development
direnv allow

# Dev
pnpm dev                          # all apps
pnpm dev --filter app             # single app

# DB
pnpm db:generate                  # generate migration
pnpm db:migrate                   # apply migrations
pnpm db:studio                    # Drizzle Studio

# Test
pnpm test
pnpm test:e2e

# Build
pnpm build

# Lint / typecheck
pnpm lint
pnpm typecheck

# Env (envx-cli)
make env-dev
make env-prod
make env-encrypt-dev
```

## Deployment commands

```bash
make deploy-app
make deploy-admin
make deploy-web
make deploy-sst                   # AWS infra via SST
make deploy-agent                 # voice worker (if applicable)
```

## Supporting skills

See `.claude/skills/` and `skills-lock.json`. Pre-installed:
- `better-auth-best-practices`
- `neon-postgres`
- `next-best-practices`
- `next-cache-components`
- `turborepo`
- `vercel-react-best-practices`
- `vercel-composition-patterns`
- `web-design-guidelines`
- `module-audit`
- `<others per project>`

## Related
- **Architecture overview:** [architecture-overview.md](./architecture-overview.md)
- **Decisions (ADRs):** [decisions.md](./decisions.md)
- **NFR:** [shared/nfr.md](./shared/nfr.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

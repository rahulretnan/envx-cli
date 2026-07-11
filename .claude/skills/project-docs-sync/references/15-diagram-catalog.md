# 15 — Diagram Catalog

Every project produced by this skill ships with a layered set of Mermaid
diagrams: high-level architecture overview, per-module flows, and per-feature
sequence diagrams. The skill must generate ALL applicable diagrams below —
never skip "for brevity".

## Diagram inventory

### Project-wide (generated into `docs/project/architecture-overview.md`)

1. **System architecture** (component diagram) — every app, every service,
   every external integration, every datastore, every queue/scheduler. Shows
   how the whole thing fits together at a glance.
2. **Request lifecycle** (sequence) — a representative user request from
   client → CDN → frontend → API → DB → response. Highlights where caching,
   auth, rate limiting, telemetry hook in.
3. **Data flow** (flowchart) — where data enters (forms, webhooks, integrations,
   uploads), how it transforms (validation, enrichment, indexing), where it
   lands (Postgres, S3, vector store, search index), how it leaves (REST, GraphQL,
   webhooks out, exports, notifications).
4. **Deployment topology** — what runs where (Vercel projects, SST Lambdas,
   Hasura container, LiveKit SFU, EAS-built mobile bundles), with region
   annotations.
5. **Auth flow** (sequence) — login → OAuth → session → request authentication →
   refresh → logout, including admin-impersonation if relevant.
6. **Tenancy model** (entity-relationship) — how org/team/user/workspace
   entities relate; which tables are tenant-scoped and how.
7. **Module map** (mind-map or graph) — every module, its primary entities,
   its dependencies on other modules.
8. **Async architecture** — every queue + every scheduler + every webhook
   (in/out), with consumer Lambdas mapped.
9. **Permission flow** (sequence) — a request hitting an authenticated procedure,
   going through auth middleware → tenancy check → permission check → handler.

### Per-module (generated into `docs/project/modules/<module>/module.md`)

Every module file MUST contain these:

10. **Module component diagram** — pages of this module, components inside
    each page, API procedures called, DB tables read/written, events emitted,
    external services touched.
11. **Page navigation flow** — entry points to this module, navigation
    between pages within it, deep links from other modules, breadcrumb path.
12. **Role × page visibility matrix** (table, not diagram — but counted here
    because it lives alongside diagrams).

### Per-feature (generated into `docs/project/modules/<module>/features/feature-*.md`)

13. **End-to-end sequence** — UI → handler → service → DB → side-effects.
    The non-negotiable wiring diagram. See feature template.

### Per-stateful-entity (generated into `docs/project/modules/<module>/state-machines/status-*.md`)

14. **State machine** — every state, every transition (with the action that
    triggers it), guards, side-effects per transition.

### Per-async-job (generated into `docs/project/modules/<module>/async-jobs/job-*.md`)

15. **Job execution flow** — trigger → fetch input → process → retries → DLQ
    → alerting → success path.

### Per-workflow (generated into `docs/project/modules/<module>/workflows/workflow-*.md`)

16. **Workflow swimlane** — actors (User, System, External) across lanes,
    happy path + alternative paths + failure scenarios + recovery.

## Mermaid templates

Below are skeleton templates the skill should fill in.

### Template — System architecture (component)

```mermaid
flowchart TB
  subgraph Clients
    Web[Web app · Next.js]
    Admin[Admin app · Next.js]
    Mobile[Mobile · Expo]
    SDK[Customer SDK]
  end

  subgraph Edge
    CDN[CloudFront / Vercel Edge]
  end

  subgraph API
    HonoServer[Hono+Bun · oRPC]
    OpenAPI[/api/v1 REST/]
    Webhooks[Webhook receivers]
  end

  subgraph Async
    QStash[Upstash QStash]
    Workflow[Upstash Workflow]
    Cron[SST Cron Lambdas]
  end

  subgraph Data
    DB[(Neon Postgres)]
    Redis[(Upstash Redis)]
    Vectors[(S3 Vectors)]
    S3[(S3 buckets)]
  end

  subgraph External
    Auth[Google / GitHub OAuth]
    Pay[Dodopayments]
    Mail[ZeptoMail]
    WA[WhatsApp Cloud API]
    LLM[AI SDK Gateway]
  end

  Clients --> CDN --> HonoServer
  SDK --> OpenAPI --> HonoServer
  HonoServer --> DB & Redis & S3 & Vectors
  HonoServer --> Auth & Pay & Mail & WA & LLM
  HonoServer --> QStash --> Cron
  Webhooks --> HonoServer
  Pay --> Webhooks
```

### Template — Request lifecycle (sequence)

```mermaid
sequenceDiagram
  participant U as User
  participant CDN as CDN/Edge
  participant FE as Next.js (RSC)
  participant API as oRPC handler
  participant MW as Middleware<br/>(auth · rate-limit · tenancy · permission)
  participant SVC as Service
  participant DB as Postgres
  participant CACHE as Redis cache
  participant TEL as Telemetry

  U->>CDN: GET /occupants
  CDN->>FE: render
  FE->>API: occupant.list
  API->>MW: validate session, check rate limit
  MW->>CACHE: cache lookup
  alt cache hit
    CACHE-->>API: cached payload
  else miss
    MW->>SVC: list(input, ctx)
    SVC->>DB: SELECT ...
    DB-->>SVC: rows
    SVC-->>CACHE: SET (60s TTL)
    SVC-->>API: result
  end
  API-->>FE: payload
  FE-->>U: rendered page
  API-->>TEL: span + event
```

### Template — Data flow (flowchart)

```mermaid
flowchart LR
  subgraph Inputs
    Form[User forms]
    Upload[File uploads]
    WhIn[Inbound webhooks]
    Integ[OAuth integrations]
  end

  subgraph Transform
    Validate[Zod validation]
    Enrich[Service-layer enrichment]
    Index[Index for search/vector]
  end

  subgraph Stores
    PG[(Postgres)]
    Bucket[(S3)]
    Vec[(Vectors)]
    Search[(Search index)]
  end

  subgraph Outputs
    REST[/api/v1/]
    GQL[GraphQL]
    Email[Email/WhatsApp/SMS]
    WhOut[Outbound webhooks]
    Export[CSV/PDF exports]
  end

  Inputs --> Validate --> Enrich
  Enrich --> PG
  Enrich --> Index --> Vec & Search
  Upload --> Bucket
  PG --> REST & GQL & Export
  PG --> Email & WhOut
```

### Template — Deployment topology

```mermaid
flowchart TB
  subgraph User-Side
    Browser[Browser]
    iOS[iOS app]
    Android[Android app]
  end

  subgraph Vercel ap-south-1
    NextWeb[apps/web]
    NextApp[apps/app]
    NextAdmin[apps/admin]
    Docs[apps/docs · Fumadocs]
  end

  subgraph AWS ap-south-1
    direction TB
    S3[S3 bucket]
    CFront[CloudFront + OAC]
    Lams[SST Lambdas · workers]
    Cron[SST Cron]
  end

  subgraph Railway/Lightsail
    HonoSrv[Hono+Bun API · persistent]
    VoiceWorker[LiveKit Agent worker · persistent]
  end

  subgraph 3rd-Party
    Neon[Neon Postgres]
    Upstash[Upstash QStash+Redis]
    Zepto[ZeptoMail]
    Dodo[Dodopayments]
    Meta[WhatsApp Cloud]
  end

  User-Side --> CFront --> S3
  User-Side --> NextWeb & NextApp & NextAdmin
  NextApp --> HonoSrv
  HonoSrv --> Neon
  HonoSrv --> Upstash --> Lams
  HonoSrv --> Zepto & Dodo & Meta
  iOS & Android --> HonoSrv
  iOS & Android --> VoiceWorker
```

### Template — Auth flow

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Web app
  participant AUTH as Better Auth
  participant G as Google OAuth
  participant DB as Postgres

  U->>FE: Click "Sign in with Google"
  FE->>AUTH: GET /api/auth/sign-in/google
  AUTH->>G: redirect
  G->>U: consent
  U->>G: approve
  G->>AUTH: callback w/ code
  AUTH->>G: exchange code for tokens
  AUTH->>DB: upsert user, create session
  AUTH-->>FE: set httpOnly cookie (askshelf.session_token)
  FE-->>U: redirect to dashboard
  Note over AUTH,DB: Subsequent requests carry cookie<br/>middleware reads + populates ctx.session
```

### Template — Module component diagram

```mermaid
flowchart LR
  subgraph Pages
    P1[/occupants]
    P2[/occupants/:id]
    P3[/occupants/new]
  end

  subgraph Components
    Table[OccupantTable]
    Filter[FilterBar]
    Form[OccupantForm]
    Scanner[AadhaarScanner]
    Tabs[Detail tabs · Rent/KYC/History]
  end

  subgraph API
    List[occupant.list]
    Get[occupant.get]
    Create[occupant.create]
    Update[occupant.update]
    Vacate[occupant.vacate]
  end

  subgraph DB
    T1[(occupant)]
    T2[(occupant_history)]
    T3[(kyc_doc)]
  end

  subgraph Events
    E1>occupant.created]
    E2>occupant.vacated]
  end

  P1 --> Table & Filter --> List --> T1
  P2 --> Tabs --> Get --> T1 & T2 & T3
  P3 --> Form --> Scanner
  P3 --> Create --> T1 & T2
  Create --> E1
  P2 --> Vacate --> T1 & T2
  Vacate --> E2
```

### Template — Page navigation

```mermaid
flowchart LR
  Sidebar[Sidebar · Occupants link] --> List[/occupants]
  Dashboard[Dashboard · recent activity] --> Detail[/occupants/:id]
  List --> Detail
  List --> Create[/occupants/new]
  Detail --> History[/occupants/:id/history]
  Detail --> AllocateRoom[/rooms?occupantId=:id]
  Create --> Detail
```

### Template — State machine

```mermaid
stateDiagram-v2
  [*] --> Pending
  Pending --> Paid : payment.completed
  Pending --> Overdue : due_date passed
  Overdue --> Paid : payment.completed
  Overdue --> Cancelled : owner.cancel
  Paid --> Refunded : owner.refund
  Cancelled --> [*]
  Refunded --> [*]
  note right of Overdue : sends reminder (T-3, T+0, T+3, T+7)
```

### Template — Job execution

```mermaid
flowchart TB
  Trigger[QStash POST] --> Verify[verify signature]
  Verify -->|invalid| Reject[401]
  Verify -->|valid| Idemp[check Redis idempotency]
  Idemp -->|seen| Skip[200 — already processed]
  Idemp -->|new| Fetch[fetch input]
  Fetch --> Process[do work]
  Process -->|success| Persist[write result]
  Process -->|retryable error| Retry[QStash retries · max 3]
  Process -->|permanent error| DLQ[send to DLQ]
  Persist --> Mark[mark idempotency key]
  Mark --> Done[200]
  DLQ --> Alert[Sentry alert]
```

### Template — Workflow swimlane

```mermaid
sequenceDiagram
  participant U as User (Owner)
  participant FE as Web app
  participant SVC as Service
  participant DB as DB
  participant EXT as External (Dodo)
  participant EMAIL as Email

  U->>FE: Click "Start subscription"
  FE->>SVC: billing.start
  SVC->>EXT: create checkout
  EXT-->>SVC: checkout URL
  SVC-->>FE: redirect URL
  FE-->>U: open checkout
  U->>EXT: complete payment
  EXT->>SVC: webhook (subscription.created)
  SVC->>DB: insert subscription
  SVC->>EMAIL: send activation
  EMAIL-->>U: confirmation email
```

## Authoring rules

- Every diagram has a one-line caption above it explaining what it shows.
- Every node name is consistent across diagrams (don't call it "Hono server"
  in one and "API" in another).
- Use Mermaid blocks, not Graphviz / PlantUML / image embeds — Mermaid renders
  in GitHub, VS Code, most docs portals.
- If a diagram exceeds ~30 nodes, split it.
- If a project has only one module, still produce the project-wide diagrams —
  they're the entry point for Claude Code and human reviewers.
- **Diagrams are part of the change-tracking sidecar.** Any change that
  affects a diagram (new module, new external integration, removed table,
  new event) must regenerate the diagram AND bump its version.

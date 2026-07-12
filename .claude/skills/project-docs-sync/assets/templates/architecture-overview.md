---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Scope: Project-wide
---

# Architecture Overview

The 9 mandatory project-wide diagrams. Skip none.

## 1. System architecture

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

## 2. Request lifecycle

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

  U->>CDN: GET /<route>
  CDN->>FE: render
  FE->>API: <procedure>
  API->>MW: validate session + check rate limit
  MW->>CACHE: cache lookup
  alt cache hit
    CACHE-->>API: cached payload
  else miss
    MW->>SVC: handler(input, ctx)
    SVC->>DB: SELECT
    DB-->>SVC: rows
    SVC-->>CACHE: SET (60s TTL)
    SVC-->>API: result
  end
  API-->>FE: payload
  FE-->>U: rendered page
  API-->>TEL: span + event
```

## 3. Data flow

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
    Enrich[Service enrichment]
    Index[Search / vector index]
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
    Email[Email / WhatsApp / SMS]
    WhOut[Outbound webhooks]
    Export[CSV / PDF exports]
  end

  Inputs --> Validate --> Enrich
  Enrich --> PG
  Enrich --> Index --> Vec & Search
  Upload --> Bucket
  PG --> REST & GQL & Export
  PG --> Email & WhOut
```

## 4. Deployment topology

```mermaid
flowchart TB
  subgraph User-Side
    Browser[Browser]
    iOS[iOS]
    Android[Android]
  end

  subgraph Vercel[Vercel · ap-south-1]
    NextWeb[apps/web]
    NextApp[apps/app]
    NextAdmin[apps/admin]
    Docs[apps/docs · Fumadocs]
  end

  subgraph AWS[AWS · ap-south-1]
    S3[S3 bucket]
    CFront[CloudFront + OAC]
    Lams[SST Lambdas · workers]
    Cron[SST Cron]
  end

  subgraph Persistent[Railway / Lightsail]
    HonoSrv[Hono+Bun API]
    VoiceWorker[LiveKit Agent worker]
  end

  subgraph TP[3rd-party services]
    Neon[Neon Postgres]
    Upstash[Upstash QStash + Redis]
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

## 5. Auth flow

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
  AUTH->>G: exchange code → tokens
  AUTH->>DB: upsert user, create session
  AUTH-->>FE: set httpOnly cookie
  FE-->>U: redirect to dashboard
  Note over AUTH,DB: Subsequent requests carry cookie<br/>middleware reads + populates ctx.session
```

## 6. Tenancy model

```mermaid
erDiagram
  organization ||--o{ member : "has"
  user ||--o{ member : "belongs"
  organization ||--o{ project_entity : "owns (tenant-scoped)"
  organization {
    text id PK
    text name
    text slug UK
  }
  member {
    uuid id PK
    text user_id FK
    text organization_id FK
    text role
    text[] permissions
  }
  user {
    text id PK
    text email UK
    text name
  }
  project_entity {
    uuid id PK
    text org_id FK "indexed"
    text name
  }
```

## 7. Module map

```mermaid
flowchart LR
  Identity --> Tenants
  Identity --> Team
  Tenants --> Money
  Team --> Tenants
  Operations --> Identity
  Operations --> Tenants
  Operations --> Money
  Platform --> Identity
  Platform --> Tenants
  Platform --> Money
  Platform --> Team
```

(Customise per project — show the actual module list and dependency arrows.)

## 8. Async architecture

```mermaid
flowchart LR
  subgraph Producers
    API[oRPC procedures]
    Web[Webhook receivers]
    Cron[Cron triggers]
  end

  subgraph Bus
    QS[Upstash QStash]
    WF[Upstash Workflow]
    EB[EventBridge Scheduler]
  end

  subgraph Consumers
    L1[Worker: send-email]
    L2[Worker: bulk-import]
    L3[Worker: generate-export]
    L4[Worker: process-payment]
    L5[Cron: daily-rent-gen]
    L6[Per-row: send-reminder]
  end

  subgraph Sinks
    DB[(Postgres)]
    S3[(S3)]
    EXT[External services]
    DLQ[(DLQ)]
  end

  API --> QS
  Web --> QS
  Cron --> EB
  QS --> L1 & L2 & L3 & L4
  WF --> L2
  EB --> L6
  L1 & L4 --> EXT
  L2 & L3 --> S3
  L5 --> DB
  L1 & L2 & L3 & L4 --> DLQ
```

## 9. Permission flow

```mermaid
sequenceDiagram
  participant C as Client
  participant API as oRPC handler
  participant Auth as Auth MW
  participant Ten as Tenancy MW
  participant Perm as Permission MW
  participant RL as Rate-limit MW
  participant H as Handler
  participant DB as DB

  C->>API: request w/ cookie
  API->>Auth: validate session
  alt no session
    Auth-->>C: 401 UNAUTHORIZED
  end
  Auth->>Ten: extract activeOrganizationId
  alt no active org
    Ten-->>C: 401 NO_ACTIVE_ORG
  end
  Ten->>Perm: check role × resource × action
  alt denied
    Perm-->>C: 403 FORBIDDEN
  end
  Perm->>RL: check sliding window
  alt limited
    RL-->>C: 429 + Retry-After
  end
  RL->>H: invoke handler
  H->>DB: query (org-scoped)
  DB-->>H: rows
  H-->>C: payload
```

## Related
- **Module diagrams:** per-module in `modules/<m>/module.md`
- **NFR:** [nfr.md](./shared/nfr.md)
- **Async architecture detail:** [async-architecture.md](./shared/async-architecture.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

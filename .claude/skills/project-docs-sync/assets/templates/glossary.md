---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
---

# Glossary

Single source of truth for project vocabulary. When two docs use different
terms for the same thing, fix them by aligning to this file.

## User roles

| Term | Definition | Can log in | Tier |
|---|---|---|---|
| **Platform Admin** | Internal staff with cross-org access | Yes | Platform |
| **Org Owner** | Person who created or owns the org | Yes | Org |
| **Org Admin** | Admin within an org | Yes | Org |
| **<Role>** | <Description> | Yes/No | <Tier> |
| **<Data record>** | Stored as a record only, not a user | No | Data |

## Core domain concepts

| Term | Definition | Don't confuse with |
|---|---|---|
| **Module** | A top-level area in the product (e.g. "Tenants") | Feature (smaller unit inside a module) |
| **Feature** | A capability within a module (e.g. "Bulk import") | Module |
| **Action** | A user-triggered operation (e.g. "Archive") | API procedure (the implementation) |
| **Entity** | A persistent business object (Occupant, Hostel) | Record / row (DB instance) |
| **Org** | A tenant in the multi-tenant model | Account / customer |
| **Tenant** | An isolation boundary (usually = Org) | Customer |
| **Subscription** | Org-level billing relationship | Plan / Product |
| **Plan** | A pricing tier | Subscription |

## Technical terms

| Term | Definition |
|---|---|
| **Archetype** | One of Better-T-Stack / Hasura+Amplify Hybrid / Vite SPA |
| **oRPC** | Type-safe RPC framework, primary internal API in Archetype A |
| **Better Auth** | TypeScript-first auth framework, used with plugins |
| **Hasura** | GraphQL Engine over Postgres, primary data API in Archetype B |
| **Cognito** | AWS user pool, used as auth provider in Archetype B |
| **SST** | Serverless Stack — IaC for AWS Lambdas |
| **Amplify Gen 2** | AWS framework for provisioning Cognito + S3 + Lambdas + AppSync |
| **QStash** | Upstash queue-as-a-service |
| **Upstash Workflow** | Multi-step orchestration for QStash |
| **envx-cli** | Tool for GPG-encrypted env file workflow |
| **Dodopayments** | Payment gateway preferred for India-market SaaS |
| **LiveKit** | WebRTC SFU for real-time voice/video |
| **Mastra** | TypeScript agent framework with Memory + Tools |
| **EventBridge Scheduler** | AWS service for per-row scheduled jobs |
| **Hasura Action** | Custom mutation routed from Hasura to Lambda via API Gateway |

## Action verbs (project-wide consistency)

| Verb | Use |
|---|---|
| **Create / Add** | Bring a new entity into existence |
| **Edit / Update** | Modify an existing entity |
| **Archive** | Soft-delete (recoverable) |
| **Restore** | Un-archive |
| **Delete (permanently)** | Hard-delete |
| **Allocate** | Assign one entity to another (e.g. occupant to bed) |
| **Vacate** | Reverse allocation, close associated records |
| **Invite** | Send an invitation to join an org |
| **Impersonate** | Admin acts as another user |
| **Export** | Async generation of a downloadable file |
| **Import** | Async ingestion of an uploaded file |

## Status enums

For each entity with status:

### `<entity>.status`
| Value | Meaning | Terminal? |
|---|---|---|
| `<state>` | <meaning> | <yes/no> |

(Repeat per entity.)

## Naming conventions

| What | Convention | Example |
|---|---|---|
| Table | snake_case singular | `occupant`, `rent_payment` |
| Column | snake_case | `created_at`, `org_id` |
| Enum value | snake_case | `pending`, `over_due` |
| API procedure | dot.case | `occupant.list`, `occupant.bulk-import` |
| Telemetry event | dot.case (snake) | `occupant.created`, `bulk_import.started` |
| File | kebab-case | `occupant-form.tsx` |
| React component | PascalCase | `OccupantForm` |
| Hook | camelCase, leading use | `useOccupant` |
| Env var | SCREAMING_SNAKE | `DATABASE_URL`, `AADHAAR_ENCRYPTION_KEY` |

## What to avoid

- "User" without qualifying which role — pick Owner, Warden, Customer
- "Item" — use the actual entity name
- "Manage X" — use specific verb (list, create, archive)
- Mixing Owner/Admin in the same matrix — separate them
- "Just a flag" or "a setting" — name it explicitly

## Adding terms

When a new term enters the project:
1. Add to this file with definition
2. Search for prior uses of synonyms; update them
3. Append to changelog below

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial glossary |

---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Module: <module-name>
API Style: oRPC
---

# API: <Feature> (oRPC)

## Overview
<Brief description of what this API handles.>

**Router file:** `packages/api/src/routers/<router>.ts`
**Mount point:** `/api/rpc/[[...rest]]` (handled by RPCHandler + OpenAPIHandler)
**OpenAPI reference:** `/api/rpc/api-reference`

## Middleware stack

| Order | Middleware | Purpose |
|---|---|---|
| 1 | `httpLog` | Request/response logging w/ trace id |
| 2 | `sentryTrace` | Sentry span wrap |
| 3 | `auth` | Validates session cookie via Better Auth |
| 4 | `tenancy` | Extracts `activeOrganizationId` |
| 5 | `permission(<roles>, <resource>, <actions>)` | RBAC check |
| 6 | `rateLimit(<limit>)` | Per-IP or per-user sliding window |
| 7 | `captcha` (mutations on public routes only) | Cloudflare Turnstile |
| 8 | handler | Business logic |

## Context shape (`ctx`)

```typescript
type Context = {
  req: Request;
  session: Session | null;
  user: User | null;
  activeOrganizationId: string | null;
  memberRole: Role | null;
  db: typeof db;
  ip: string;
  userAgent: string;
  traceId: string;
};
```

## Procedures Summary

| Type | Procedure | Description | Auth tier | Rate limit |
|------|-----------|-------------|-----------|------------|
| Query | `<feature>.list` | List items | `protectedProcedure` | — |
| Query | `<feature>.get` | Get single | `protectedProcedure` | — |
| Query | `<feature>.search` | Full-text search | `protectedProcedure` | 30/min |
| Mutation | `<feature>.create` | Create | `protectedProcedure` + role | 10/min |
| Mutation | `<feature>.update` | Update | `protectedProcedure` + role | 30/min |
| Mutation | `<feature>.archive` | Soft delete | `protectedProcedure` + role | 10/min |
| Mutation | `<feature>.bulk-import` | Bulk import (async via QStash) | `protectedProcedure` + role | 2/min |
| Mutation | `<feature>.export` | Async export | `protectedProcedure` + role | 5/hour |

## Procedure Details

### Query: `<feature>.list`

**Auth tier:** `protectedProcedure` + `memberOf(orgId)`
**Cache:** 60s keyed by `list:<orgId>:<filter-hash>`

**Input:**
```typescript
{
  page?: number;                       // Default 1
  limit?: number;                      // Default 20, max 100
  search?: string;                     // Optional
  filter?: { status?: Status; ... };
  sort?: { field: string; dir: 'asc' | 'desc' };
}
```

**Output:**
```typescript
{
  items: Array<{
    id: string;
    /* fields */
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Zod:**
```typescript
export const list<Feature>Schema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  filter: z.object({
    status: z.nativeEnum(Status).optional(),
  }).optional(),
  sort: z.object({
    field: z.enum(['createdAt', 'updatedAt', 'name']),
    dir: z.enum(['asc', 'desc']),
  }).default({ field: 'createdAt', dir: 'desc' }),
});
```

### Mutation: `<feature>.create`

**Auth tier:** `protectedProcedure` + `assertPermission('<resource>', 'create')`
**Idempotency:** required — `X-Idempotency-Key` header, Redis `SET NX EX 600`
**Rate limit:** 10/min per user

**Input:**
```typescript
{
  field1: string;                      // 1-100 chars
  field2?: string;
  ...
}
```

**Output:**
```typescript
{ id: string; /* full entity */ }
```

**Side-effects:**
- INSERT into `<table>` (transaction)
- INSERT into `<table>_history` (audit)
- Emits `<entity>.created` event → consumed by Notifications module
- Enqueues `send-welcome-email` job (QStash)

(Repeat per procedure.)

## Error Responses

All procedures may return:

| Code | When | Sample message |
|---|---|---|
| `VALIDATION_ERROR` | Zod fails | "Field is required" |
| `UNAUTHORIZED` | No session | "Authentication required" |
| `FORBIDDEN` | Permission denied | "You don't have permission to perform this action" |
| `NOT_FOUND` | Item doesn't exist | "Resource not found" |
| `CONFLICT` | Duplicate or stale | "Resource already exists" |
| `RATE_LIMITED` | Limit exceeded | `Retry-After` header set |
| `EXTERNAL_FAILURE` | Upstream service failed | "Service temporarily unavailable" |
| `INTERNAL` | Unknown | Generic + Sentry trace |

## Telemetry

Every procedure call emits:
- `<router>.<procedure>.invoked` (success: bool, durationMs, errorCode?)
- Sentry span with route, status, orgId, userId

## Related
- **Module:** [module.md](../module.md)
- **Schema:** [schema-<name>](../schema/schema-<name>.md)
- **Feature:** [feature-<name>](../features/feature-<name>.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

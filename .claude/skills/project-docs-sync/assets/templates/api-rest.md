---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Module: <module-name>
API Style: REST (public /v1)
---

# API: <Feature> (REST `/api/v1`)

## Overview
Public REST surface for partner/SDK consumers. Stable contract — bumps go
through deprecation policy below.

**Versioning:** `/api/v1/...` — never break v1. Add `/v2/...` for breaking changes.
**Mount:** `apps/app/src/app/api/v1/<resource>/route.ts` (Next route handler)

## Authentication

- **Header**: `Authorization: Bearer sk_live_xxx` (or `X-API-Key`)
- API key stored SHA-256 hashed (Better Auth `apiKey` plugin)
- Key scope: org-scoped, optional resource scope
- Rate limit: 100/min per key (sliding window)

## Endpoints

| Method | Path | Description | Cache TTL |
|---|---|---|---|
| GET | `/api/v1/<resource>` | List | 60s |
| GET | `/api/v1/<resource>/:id` | Get one | 60s |
| GET | `/api/v1/<resource>/slug/:slug` | Get by slug | 60s |
| POST | `/api/v1/<resource>` | Create | — |
| PATCH | `/api/v1/<resource>/:id` | Update | — |
| DELETE | `/api/v1/<resource>/:id` | Delete | — |

## Endpoint detail

### GET `/api/v1/<resource>`

**Query params:**
```
?limit=20            # max 100
&offset=0
&filter[status]=published
&sort=-createdAt     # leading `-` = desc
```

**Headers:**
- `Authorization: Bearer <key>` (required)
- `Accept: application/json`

**Response 200:**
```json
{
  "data": [
    { "id": "uuid", "title": "...", "status": "published", "createdAt": "ISO" }
  ],
  "meta": { "limit": 20, "offset": 0, "total": 1245 },
  "links": {
    "self": "/api/v1/<resource>?limit=20&offset=0",
    "next": "/api/v1/<resource>?limit=20&offset=20"
  }
}
```

**Headers returned:**
- `X-Cache: HIT|MISS`
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 87`
- `X-RateLimit-Reset: 1717142400`

**Errors:**

| Status | code | When |
|---|---|---|
| 400 | `invalid_request` | Malformed query / body |
| 401 | `unauthorized` | Missing/invalid key |
| 403 | `forbidden` | Key lacks scope |
| 404 | `not_found` | Resource doesn't exist |
| 429 | `rate_limited` | Limit exceeded (+ `Retry-After`) |
| 500 | `internal_error` | Server error |

## Deprecation policy

When deprecating an endpoint or field:
1. Add `Deprecation: <date>` header to responses
2. Add `Sunset: <date>` header (RFC 8594)
3. Log usage by key for 90 days
4. Email all keys still using it at 60 and 30 days before sunset
5. Remove at sunset

## SDK consumption

Endpoints consumed by `@<org>/sdk`:

```typescript
// example
import { Client } from "@<org>/sdk";
const client = new Client({ apiKey: process.env.<ORG>_API_KEY });
const posts = await client.posts.list({ limit: 10 });
```

## Cache strategy

- Per-org caching keyed by `v1:<orgId>:<resource>:<query-hash>`
- Invalidation: on `<resource>` write events fired from the corresponding
  oRPC procedure
- Stampede: `@upstash/redis` SETEX w/ lock

## Webhooks (events delivered to customer URLs)

See `shared/webhooks-outgoing.md`.

## Related
- **Module:** [module.md](../module.md)
- **Internal API:** [api-<feature>.md](./api-<feature>.md) (oRPC equivalent)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial v1 draft |

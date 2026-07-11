---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Module: <module-name>
API Style: GraphQL via Hasura
---

# API: <Feature> (Hasura GraphQL)

## Overview
<Brief description.>

**Hasura table(s) tracked:** `<table1>`, `<table2>`
**Auth:** Cognito JWT validated against JWKS; claims map → Hasura roles
**Permissions defined in:** `services/hasura/metadata/databases/default/tables/<table>.yaml`

## Hasura roles used

| Role | x-hasura-*-claims | Notes |
|---|---|---|
| `user` | x-hasura-user-id, x-hasura-org-id | Standard authenticated user |
| `admin` | (implicit full) | Platform admin |
| `anonymous` | none | Public read-only on subset |

## Table permissions

### `<table>`

#### `user` role

**Select:**
```yaml
permission:
  columns: [id, name, status, created_at]
  filter:
    org_id: { _eq: X-Hasura-Org-Id }
  allow_aggregations: true
```

**Insert:**
```yaml
permission:
  check:
    org_id: { _eq: X-Hasura-Org-Id }
  set:
    created_by: X-Hasura-User-Id
  columns: [name, status]
```

**Update:**
```yaml
permission:
  filter:
    org_id: { _eq: X-Hasura-Org-Id }
  check: null
  columns: [name, status]
```

**Delete:** (typically blocked — use soft delete)

## Queries

### `Get<Feature>List`

```graphql
query Get<Feature>List($limit: Int = 20, $offset: Int = 0, $where: <table>_bool_exp = {}) {
  <table>(limit: $limit, offset: $offset, where: $where, order_by: { created_at: desc }) {
    id
    name
    status
    created_at
  }
  <table>_aggregate(where: $where) {
    aggregate { count }
  }
}
```

Generated artifacts:
- `packages/ui/src/graphql/<feature>/<feature>-list.generated.ts` — React Apollo hook
- `packages/hasura-sdk/src/graphql/<feature>/<feature>-list.sdk.ts` — graphql-request SDK for Lambdas

## Mutations

### `Create<Feature>`

```graphql
mutation Create<Feature>($input: <table>_insert_input!) {
  insert_<table>_one(object: $input) {
    id
    name
  }
}
```

## Subscriptions

### `Watch<Feature>List`

```graphql
subscription Watch<Feature>List($where: <table>_bool_exp = {}) {
  <table>(where: $where, order_by: { created_at: desc }) {
    id
    name
    status
    updated_at
  }
}
```

Used in: <PageComponent> for live updates.

## Computed fields

| Field | SQL function | Returns |
|---|---|---|
| `<table>.full_address` | `compute_full_address(<table>)` | text |

## Hasura Actions (side-effect mutations → Lambda)

| Action | Handler (Lambda) | Purpose |
|---|---|---|
| `addOrder` | `addOrder` Lambda | Validates stock + creates order in transaction |
| `inviteUser` | `inviteUser` Lambda | Creates Cognito user + DB row |
| `createApiKey` | `createApiKey` Lambda | Creates API Gateway key + DB row |

Action schema lives in `packages/backend/amplify/data/resource.ts` (`a.combine([...])`).

Lambda calls Hasura back via `graphql-request` SDK using admin secret.

## Permissions matrix per role

|  | Select | Insert | Update | Delete |
|---|---|---|---|---|
| `user` | own org | own org | own org | — |
| `admin` | ✓ | ✓ | ✓ | ✓ |
| `anonymous` | public subset | — | — | — |

## Telemetry

- Hasura logs every query to CloudWatch (operation name, role, duration)
- Apollo client emits `<operation>.executed` to PostHog
- Subscriptions: monitor `gql.subscription.connected/disconnected`

## Related
- **Module:** [module.md](../module.md)
- **Schema:** [schema-<name>](../schema/schema-<name>.md)
- **Feature:** [feature-<name>](../features/feature-<name>.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Module: <module-name>
API Style: AppSync (Amplify Gen 2 — RPC over Lambda)
---

# API: <Feature> (AppSync — RPC wrapper over Lambda)

## Overview

AppSync schema is used as a thin RPC wrapper over Lambda handlers — NOT
as a data layer (data is in Postgres via Hasura). This pattern matches
rankze and tiaime where Amplify Data exposes Lambda mutations under
`@aws-appsync/auth-userPool`.

**Schema definition:** `packages/backend/amplify/data/resource.ts`
**Default authorization:** `userPool` (Cognito)

## Schema composition

```typescript
const schema = a.combine([
  ...checkStockSchemaEntries,
  ...addOrderSchemaEntries,
  ...inviteUserSchemaEntries,
  // ...
]);

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
```

## Mutation entry (one per Lambda)

```typescript
// packages/backend/amplify/functions/<feature>/<action>/schema.ts
export const <action>SchemaEntries = {
  <ActionName>: a
    .mutation()
    .arguments({
      field1: a.string().required(),
      field2: a.integer(),
    })
    .returns(a.ref('<ActionName>Output'))
    .handler(a.handler.function(<actionFn>))
    .authorization((allow) => [allow.authenticated()]),

  <ActionName>Output: a.customType({
    id: a.id().required(),
    status: a.string().required(),
  }),
};
```

## Client call

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '<path>/amplify/data/resource';

const client = generateClient<Schema>();
const result = await client.mutations.<ActionName>({ field1: 'x' });
```

## Lambda handler shape

```typescript
import { type Schema } from '../../../data/resource';

export const handler: Schema['<ActionName>']['functionHandler'] = async (event) => {
  const { field1, field2 } = event.arguments;
  const userId = event.identity?.sub;
  // ... business logic — typically calls Hasura via graphql-request SDK
  return { id, status };
};
```

## Authorization patterns

```typescript
.authorization((allow) => [
  allow.authenticated(),                                          // any logged-in user
  allow.group('ADMIN'),                                           // Cognito group
  allow.authenticated().to(['mutate']),                           // only this action
  allow.publicApiKey().to(['query']),                             // API key auth
])
```

## Mutation inventory

| Mutation | Lambda | Purpose | Auth |
|---|---|---|---|
| `<ActionName>` | `<actionFn>` | <description> | authenticated |
| `<ActionName>` | `<actionFn>` | <description> | group('ADMIN') |

## Error handling

```typescript
// Lambda throws — AppSync surfaces as GraphQL error
throw new Error('VALIDATION_ERROR: field is required');

// Client catches errorType
const result = await client.mutations.<Name>(args);
if (result.errors) {
  // handle errors[0].message
}
```

## Telemetry

- CloudWatch logs per Lambda
- X-Ray traces enabled
- Custom metrics: invocation count, duration, error rate

## Related
- **Module:** [module.md](../module.md)
- **Backing Hasura tables:** [schema-<name>](../schema/schema-<name>.md)
- **Feature:** [feature-<name>](../features/feature-<name>.md)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Module: <module-name>
ORM: Hasura (Postgres via Hasura GraphQL Engine)
---

# Database Schema: <Feature> (Hasura)

## Overview
<Brief description.>

## ERD
```mermaid
erDiagram
  organization ||--o{ <table> : "has many"
  <table> ||--o{ <child> : "has many"
```

## Tables

### `<table_name>`

#### SQL definition (UP migration)

```sql
CREATE TABLE <table> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' REFERENCES <status_enum_table>(value),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES user(id) ON DELETE RESTRICT,

  CONSTRAINT <table>_slug_per_org UNIQUE (org_id, slug),
  CONSTRAINT <table>_phone_format CHECK (phone IS NULL OR phone ~ '^\+\d{10,15}$')
);

CREATE INDEX <table>_org_status_idx ON <table>(org_id, status);
CREATE INDEX <table>_created_at_idx ON <table>(created_at DESC);
CREATE INDEX <table>_active_idx ON <table>(org_id) WHERE deleted_at IS NULL;

CREATE TRIGGER set_<table>_updated_at
  BEFORE UPDATE ON <table>
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### DOWN migration

```sql
DROP TABLE IF EXISTS <table>;
```

#### Enum table pattern

For status-like columns, prefer enum tables over PG enums (Hasura tracks
them as foreign keys, generates an enum type in GraphQL):

```sql
CREATE TABLE <status_enum_table> (
  value TEXT PRIMARY KEY,
  description TEXT
);
INSERT INTO <status_enum_table> (value, description) VALUES
  ('draft', 'Not yet published'),
  ('active', 'Live and visible'),
  ('archived', 'Hidden from lists');
COMMENT ON TABLE <status_enum_table> IS E'@enum';
```

## Hasura metadata YAML

`services/hasura/metadata/databases/default/tables/<table>.yaml`:

```yaml
table:
  name: <table>
  schema: public

object_relationships:
  - name: organization
    using:
      foreign_key_constraint_on: org_id
  - name: creator
    using:
      foreign_key_constraint_on: created_by
  - name: status_enum
    using:
      foreign_key_constraint_on: status

array_relationships:
  - name: <children>
    using:
      foreign_key_constraint_on:
        column: <table>_id
        table: { name: <child>, schema: public }

select_permissions:
  - role: user
    permission:
      columns: [id, name, slug, description, status, created_at]
      filter:
        org_id: { _eq: X-Hasura-Org-Id }
        deleted_at: { _is_null: true }
      allow_aggregations: true

insert_permissions:
  - role: user
    permission:
      check:
        org_id: { _eq: X-Hasura-Org-Id }
      set:
        created_by: X-Hasura-User-Id
      columns: [name, slug, description, metadata]

update_permissions:
  - role: user
    permission:
      filter:
        org_id: { _eq: X-Hasura-Org-Id }
        deleted_at: { _is_null: true }
      check: null
      columns: [name, description, status, metadata]

delete_permissions: []     # block hard delete; use soft delete via update
```

## Migration commands

```bash
# Create
.claude/skills/hasura/scripts/new-migration.sh create-table <table> \
  --col "name:VARCHAR(100):not-null" \
  --col "slug:VARCHAR(120):not-null"

# Apply
make hasura-migrate stage=local

# Status
make hasura-migrate-status stage=local

# Refresh DBML
make create-dbml
```

## DBML representation

`services/postgres/schema.dbml`:

```dbml
Table <table> {
  id uuid [pk, default: `gen_random_uuid()`]
  org_id uuid [not null, ref: > organization.id]
  name varchar(100) [not null]
  slug varchar(120) [not null]
  status text [not null, default: 'draft', ref: > <status_enum_table>.value]
  metadata jsonb
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]
  deleted_at timestamptz
  created_by uuid [not null, ref: > user.id]
  Indexes {
    (org_id, status) [name: '<table>_org_status_idx']
    (org_id, slug) [unique, name: '<table>_slug_per_org']
  }
}
```

## Lambda-side access (graphql-request SDK)

Generated SDK in `packages/hasura-sdk/src/graphql/<feature>/`. Usage:

```typescript
import { sdk } from '@my-app/hasura-sdk';

const items = await sdk.Get<Feature>List({
  where: { org_id: { _eq: orgId } },
  limit: 20,
});
```

Lambdas authenticate as `admin` role using `x-hasura-admin-secret` from
AWS Secrets Manager.

## PII fields
See [compliance.md](../compliance.md).

## Related
- **Module:** [module.md](../module.md)
- **API:** [api-<feature>](../api/api-<feature>.md)
- **DBML overall:** `services/postgres/schema.dbml`

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |

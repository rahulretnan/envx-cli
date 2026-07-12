---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
Type: DBML overview
---

# DBML Schema — Project-wide

The full database schema in DBML format. Source-of-truth for the Hasura
archetype; reference-only for Drizzle archetype (where Drizzle schema files
are the source of truth).

**File location:** `services/postgres/schema.dbml`
**Render online:** https://dbdiagram.io

## Project header

```dbml
Project <project_name> {
  database_type: 'PostgreSQL'
  Note: '<project description>'
}
```

## Identity tables

```dbml
Table user {
  id text [pk]                  // Better Auth uses text; Cognito too
  email text [unique, not null]
  name text
  image text
  email_verified boolean [default: false]
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]
}

Table organization {
  id text [pk]
  name text [not null]
  slug text [unique, not null]
  logo text
  metadata jsonb
  created_at timestamptz [not null, default: `now()`]
}

Table member {
  id uuid [pk, default: `gen_random_uuid()`]
  user_id text [not null, ref: > user.id]
  organization_id text [not null, ref: > organization.id]
  role text [not null, default: 'member']
  permissions text[]
  created_at timestamptz [not null, default: `now()`]
  Indexes {
    (user_id, organization_id) [unique]
  }
}
```

## Per-module tables

(One section per module. Include all tables that module owns.)

### Module: Tenants

```dbml
Table occupant {
  id uuid [pk, default: `gen_random_uuid()`]
  hostel_id uuid [not null, ref: > hostel.id]
  full_name text [not null]
  phone text [not null]
  aadhaar_encrypted bytea
  aadhaar_last4 char(4)
  photo_url text
  status text [not null, default: 'active', ref: > occupant_status_enum.value]
  joined_at timestamptz [not null, default: `now()`]
  vacated_at timestamptz
  created_at timestamptz [not null, default: `now()`]
  updated_at timestamptz [not null, default: `now()`]
  deleted_at timestamptz
  Indexes {
    (hostel_id, status) [name: 'occupant_hostel_status_idx']
    (hostel_id, joined_at) [name: 'occupant_hostel_joined_idx']
    (hostel_id) [partial: 'deleted_at is null', name: 'occupant_active_idx']
  }
}

Table occupant_status_enum {
  value text [pk]
  description text
  Note: 'Hasura @enum'
}
```

(Repeat per module.)

## Enum tables (Hasura @enum pattern)

```dbml
Table <enum_name>_enum {
  value text [pk]
  description text
  Note: 'Hasura @enum'
}
```

## Foreign-key reference index

| Table | FK | References | On Delete |
|---|---|---|---|
| `<child>` | `<parent>_id` | `<parent>.id` | CASCADE |
| `<child>` | `created_by` | `user.id` | RESTRICT |

## Index rationale

Every index should have a stated purpose. Audit by running:

```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

Drop unused indexes.

## Schema versioning

Migrations under `services/hasura/migrations/default/<timestamp>-<slug>/`
or `packages/db/src/migrations/<n>_<slug>.sql`. Never edit applied
migrations — always add a new one.

## Related
- **Drizzle source-of-truth:** `packages/db/src/schema/` (Archetype A)
- **Hasura migrations:** `services/hasura/migrations/default/` (Archetype B)

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial DBML draft |

# 10 — RBAC Matrix Guide

Roles without a permission matrix are decoration. This file teaches the
skill how to force a real matrix into existence.

## Required before exiting Phase 4

Skill cannot exit Phase 4 until a draft role × top-level-resource × action
matrix exists. Stub if needed, but at least the row/column scaffold.

## Three nested matrices

### Level 1 — Role × Module (visibility)

> Can this role see this module at all?

```
            | Identity | Tenants | Money | Team | Operations | Platform |
Owner       |    ✓     |    ✓    |   ✓   |  ✓   |     ✓      |    ✓     |
Warden-View |    own   |    ✓    |   —   |  —   |     ✓      |    —     |
Warden-Write|    own   |    ✓    |   —   |  —   |     ✓      |    —     |
Warden-Pay  |    own   |    ✓    |   ✓   |  —   |     ✓      |    —     |
Platform    |    ✓     |    ✓    |   ✓   |  ✓   |     ✓      |    ✓     |
```

Legend: ✓ full · own = only own records · partial · — blocked

### Level 2 — Role × Module × Action (capability)

Per module. Example for Tenants:

```
Action            | Owner | Warden-V | Warden-W | Warden-P |
list              |   ✓   |    ✓     |    ✓     |    ✓     |
get               |   ✓   |    ✓     |    ✓     |    ✓     |
create            |   ✓   |    —     |    ✓     |    —     |
update            |   ✓   |    —     |    ✓     |    —     |
allocate-room     |   ✓   |    —     |    —     |    —     |
vacate            |   ✓   |    —     |    —     |    —     |
bulk-import       |   ✓   |    —     |    —     |    —     |
export            |   ✓   |    —     |    —     |    —     |
delete (hard)     |   —   |    —     |    —     |    —     |
archive (soft)    |   ✓   |    —     |    —     |    —     |
audit-view        |   ✓   |    —     |    —     |    —     |
```

### Level 3 — Role × Field (field-level when sensitive)

Only when needed (PII fields, financial fields):

```
Field                  | Owner | Warden | Customer |
occupant.full_name     |  RW   |   R    |    R     |
occupant.aadhaar_full  |  -    |   -    |    -     |  (never readable)
occupant.aadhaar_last4 |  R    |   R    |    R     |
occupant.phone         |  RW   |   R    |    R     |
occupant.kyc_doc       |  R    |   -    |    R     |
rent.amount            |  RW   |   R*   |    R     |  (* only Warden-Pay)
audit_log.*            |  R    |   -    |    -     |
```

Legend: R read · W write · RW both · - blocked

## How to interview the user

Skill must ask incrementally, never dump a blank matrix.

### Step 1 — Confirm role list
> "Roles you mentioned: Owner, Warden, Platform Admin. Should Warden be one
> role or split into permission tiers? In hostelsync we split into 6 (view,
> write, allocate, payments, etc.). Recommendation?"

### Step 2 — For each role × module, ask visibility
> "Does Warden see the Money module at all? If yes — own hostel only or
> all? If no — what's the user-facing message when they try?"

### Step 3 — For each visible module × action, ask capability
> "On Tenants → 'vacate' action: owner only, or warden-write too? In
> hostelsync we made vacate owner-only because it triggers refund logic."

### Step 4 — For sensitive fields, ask field-level
> "Occupant has an Aadhaar number. Who reads the full number vs only last
> 4 digits? In hostelsync no one reads the full number — it's only stored
> encrypted for re-verification."

## Where the matrix lives in generated docs

- **`docs/project/modules/<module>/module.md`** — Role × Action matrix per
  module (the actionable one)
- **`docs/project/shared/rbac.md`** — Role × Module visibility matrix
  (cross-module) + Field-level matrix for sensitive entities
- **Implementation source-of-truth**: `packages/auth/permissions.ts`
  generated from this matrix

## Common patterns from real projects

### askshelf — multi-tenant with permission DSL
```ts
ac, roles: storeOwner, teamMember, platformAdmin
permissions: { resource × actions } via custom DSL
enforced in middleware: assertPermission(role, resource, actions)
```

### hostelsync — 6-permission warden tiers
- warden:view
- warden:write
- warden:allocate
- warden:payments
- warden:reports
- warden:settings

User can hold multiple permissions; OR semantics.

### tiaime — system-defined RBAC for family roles
- 17 permissions × 5 family roles (parent, partner, caregiver, family, self)
- admin role has implicit full access

## Anti-patterns to flag

- **Single "user" role with feature flags as permissions** — leads to
  permission spaghetti. Use a real role with multiple permissions.
- **Permissions checked inline in handlers** — duplicates the matrix.
  Use middleware (`adminProcedure`, `wardenProcedure(permission)`).
- **Read permissions ignored** — most matrices only cover writes. List
  reads explicitly, especially for PII fields.
- **Matrix in CLAUDE.md but not in code** — the matrix lives in
  `packages/auth/permissions.ts`. CLAUDE.md just references it.

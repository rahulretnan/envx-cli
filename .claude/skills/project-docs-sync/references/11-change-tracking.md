# 11 — Change Tracking (always-on protocol)

After initial generation, any later edit re-enters this protocol. The skill
**rewrites** affected files (not diff-and-approve per file) and **logs a
pointer** in `docs/project/changes-log.md`. Refuses silent edits.

## When this protocol kicks in

ANY of:
- User asks to add / modify / remove a feature, action, API, table, role,
  state, event, integration, or NFR
- User asks to rename anything (column, route, role, module)
- User reports the code diverged from docs
- User wants to extend a cross-cut (add a new compliance rule, new
  observability metric)

## Protocol (7 steps)

### Step A — Identify affected docs

Map the change to every touched doc. Use the following mapping:

| Change type | Touches |
|---|---|
| Add module | `index/modules.md`, `modules/<new>/*` (full set), `architecture-overview.md` (system + module-map diagrams), `tech-stack.md` (if new deps), `decisions.md` (ADR for grouping decision) |
| Rename module | `index/modules.md`, every `modules/*/module.md` that cross-references, all internal links, all diagrams referencing the old name |
| Add feature | `modules/<m>/module.md` (action matrix + page inventory), `features/feature-<new>.md`, `api/`, `schema/`, `workflows/`, `observability.md`, `test-plan.md`, `compliance.md` (if PII) |
| Add API procedure | `api/api-<router>.md`, `module.md` (action row), `architecture-overview.md` request-lifecycle if novel pattern, `index/apis.md` |
| Add DB column | `schema/schema-<table>.md`, `compliance.md` (if PII), `module.md` (action row may need update), feature wiring diagrams that show this column, drizzle/hasura migration |
| Add role / permission | `shared/rbac.md`, every `module.md` action matrix, `feature.md` permission tables, `packages/auth/permissions.ts` |
| Add state | `state-machines/status-<entity>.md`, `module.md` (action matrix new transitions), workflows that use this state |
| Add event | `observability.md` (new event), `shared/observability-architecture.md`, modules that emit + consume, `architecture-overview.md` data-flow diagram |
| Add integration | `tech-stack.md`, `architecture-overview.md` system + deployment diagrams, `shared/integrations.md`, env vars in `env/`, secrets in deploy config |
| Add async job | `async-jobs/job-<name>.md`, `shared/async-architecture.md`, `architecture-overview.md` async diagram |
| Add cross-cut (compliance, NFR) | corresponding `shared/*.md` |

### Step B — Diff & classify change

Classify as one of:
- **additive** (no breaking change to other docs)
- **breaking** (other docs need to change — e.g. column rename)
- **rename** (search-and-replace propagation)
- **removal** (cascade — what to do with orphaned references)
- **architectural** (crosses an ADR seam — needs new ADR)

### Step C — Confirm with user before writing

Skill says:

> The change "<summary>" touches these <n> files:
> - `docs/project/modules/<m>/module.md` (action matrix updated)
> - `docs/project/modules/<m>/features/feature-<x>.md` (wiring diagram regen)
> - `docs/project/modules/<m>/schema/schema-<t>.md` (column added)
> - `docs/project/shared/compliance-pii-inventory.md` (PII field tagged)
> - `docs/project/architecture-overview.md` (data-flow diagram regen)
> - `docs/project/changes-log.md` (pointer entry)
>
> Classification: **breaking** (column rename — needs migration).
>
> I'll rewrite each file in place. Proceed?

Wait for confirmation. Then proceed.

### Step D — Rewrite affected files

- Rewrite each file using its template + the change applied
- Bump version frontmatter (e.g. `Version: 1.1` → `1.2`)
- Append row to local `## Changelog` table in each file:

```markdown
| Version | Date       | Changes                              |
|---------|------------|--------------------------------------|
| 1.2     | 2026-06-15 | Added `phone_alt` column (PII)        |
```

- Regenerate Mermaid diagrams that depict the changed element

### Step E — Append pointer to `changes-log.md`

Single source-of-truth log. Format:

```markdown
## 2026-06-15T14:32:00Z — Added phone_alt column to occupant

**Change type**: additive (DB column + PII tag)
**Triggered by**: user request to "let occupants register a secondary phone"
**Classification**: additive

**Files rewritten** (5):
- `modules/tenants/module.md` v1.0 → v1.1
- `modules/tenants/features/feature-occupant-register.md` v1.0 → v1.1
- `modules/tenants/schema/schema-occupant.md` v1.0 → v1.1
- `shared/compliance-pii-inventory.md` v2.3 → v2.4
- `architecture-overview.md` v1.2 → v1.3 (data-flow regen)

**ADR triggered**: none
**Downstream actions required**:
- [ ] Run `pnpm db:generate && pnpm db:migrate`
- [ ] Update `occupantCreateSchema` Zod in `packages/api`
- [ ] Update OccupantForm component to include the new field
- [ ] Add to bulk-import column mapping

**Open questions**: optional vs required? defaulted?
```

### Step F — Add ADR if architectural

If the change is architectural (crosses an ADR seam), generate
`docs/project/adr/<NNNN>-<slug>.md` and link from `decisions.md`.

### Step G — Re-run verification on affected docs

Run subset of `09-verification-checklist.md` scoped to the affected files.
Present any new gaps to the user.

## Rules

- **Never silently edit.** Always Step C confirmation.
- **Always bump version + append local changelog.**
- **Always append to `changes-log.md`.** This is the audit trail.
- **Always regenerate affected diagrams.**
- **Always check downstream actions** (migrations, schema codegen, test updates).
- **If user says "just edit this one file"** → push back. "The change touches
  N files — editing only one creates drift, which is exactly what this
  protocol prevents. Want me to rewrite all N, or are you flagging that the
  others shouldn't change for a reason?"

## When user wants to bypass (allowed exceptions)

Two cases where silent edit is OK, with explicit logging:

1. **Typo fix in a single doc** — no semantic change. Log to `changes-log.md`
   with `change_type: typo`.
2. **Copy/microcopy tweak** (UI string) — limited scope. Log to
   `changes-log.md` with `change_type: copy`.

For everything else, full protocol applies.

## Versioning convention

Each doc's frontmatter has:

```yaml
Version: 1.2
Last Updated: 2026-06-15
```

Bump rules:
- **major** (1.x → 2.0): breaking change to other docs (column rename,
  removed feature, role removed)
- **minor** (1.0 → 1.1): additive (new field, new action, new event)
- **patch** (rarely tracked at doc level — folded into minor)

## Recovery: reconciling drift between docs and code

If user reports docs are behind code:

1. Read the actual code paths referenced in `tech-stack.md` and wiring docs
2. Diff against doc claims
3. Generate a "drift report" listing every mismatch
4. Present to user: "Docs are behind code in N places. Want me to:
   1. Update docs to match code (Recommended for catching up)
   2. Update code to match docs (use this if the code change was a mistake)
   3. Resolve case-by-case"
5. Whichever they pick, run the change protocol for each item.

# 18 — Code-Edit Change-Tracking Triggers

Extension of `11-change-tracking.md` for Claude Code. The protocol is
identical (7 steps: A identify → B classify → C confirm → D rewrite →
E append pointer → F ADR → G re-verify) but the **trigger surface** is
different. In Cowork, the trigger is the user saying "rename column X".
In Claude Code, the trigger is detecting the actual edit.

## Trigger surface — code paths that map to docs

| Code change | Triggers doc updates to |
|---|---|
| `packages/db/src/schema/<x>.ts` modified | `docs/project/modules/<m>/schema/schema-<x>.md` · `module.md` (if columns changed) · `compliance.md` (if PII added/removed) · feature-*.md wiring diagrams citing this table |
| `packages/api/src/routers/<x>.ts` modified | `api/api-<x>.md` · `module.md` action matrix · feature-*.md procedures section |
| `apps/<x>/src/app/.../page.tsx` modified | `module.md` page inventory · feature-*.md UI components · feature-*.md wiring diagram |
| `apps/<x>/src/components/<x>.tsx` modified | `module.md` UI components section · accessibility section if a11y touched |
| `packages/auth/src/permissions.ts` modified | `shared/rbac-matrix.md` · every module.md role × action matrix · feature-*.md permission tables |
| `packages/workers/src/handlers/<x>.ts` modified | `async-jobs/job-<x>.md` · `shared/async-architecture.md` · feature-*.md if this is the worker for a specific feature |
| `packages/email/src/templates/<x>.tsx` modified | `workflows/workflow-*.md` notifications table · `observability.md` if telemetry tagged |
| Any feature-visible behaviour change (scenarios, edge cases, copy, permissions, scope) | `user-stories/story-<slug>.md` + Asana task update w/ change comment (if stories enabled — see `22-asana-user-stories.md`) |
| New migration in `services/hasura/migrations/` or `packages/db/migrations/` | `schema-*.md` migration section · `decisions.md` if schema change is architectural |
| `next.config.js` / `vite.config.ts` modified | `tech-stack.md` · possibly `nfr.md` (performance section) |
| `package.json` deps added/removed | `tech-stack.md` deps table · `decisions.md` if it's a notable swap |
| `sst.config.ts` modified | `tech-stack.md` infra section · `architecture-overview.md` deployment diagram |
| `amplify/backend.ts` modified | Same as SST · plus possibly ADR for architectural shifts |
| New cron in `packages/cron/` | `async-jobs/job-*.md` · `shared/async-architecture.md` |
| New webhook route in `apps/app/src/app/api/webhooks/` | `shared/webhooks-incoming.md` · feature handler doc |
| `.env.example` / env files modified | `tech-stack.md` env table |

## How to detect a triggering edit

You're the agent making the edit, so you know what you wrote. BUT also
detect when the user's own edits warrant doc updates:

### Cases where YOU edit code

After every `Edit` or `Write` to a code file:

1. Check the file path against the trigger surface table.
2. If it maps, immediately enter Step A (identify affected docs).
3. Run the 7-step protocol BEFORE moving to the next task.

### Cases where USER edits code (between sessions)

Detected by pre-flight (`16-pre-flight.md`) drift scan. The validate-docs.ts
+ audit-existing-project.ts output flags discrepancies. Pre-flight surfaces
them in the drift report; you offer to fix.

### Cases where you and user co-edit

If the user edits AFTER your last action (e.g. they manually tweak a column
type), detect by re-reading the file before continuing. Compare to your
last-known state.

## 7-step protocol adapted for code edits

### A — Identify affected docs

```
Code change: `packages/db/src/schema/occupant.ts` — added `phone_alt` column

Affected docs:
- docs/project/modules/tenants/schema/schema-occupant.md (column + index)
- docs/project/modules/tenants/module.md (form action might need update)
- docs/project/modules/tenants/features/feature-occupant-register.md (wiring diagram)
- docs/project/shared/compliance-pii-inventory.md (PII tag if applicable)
- docs/project/architecture-overview.md (data-flow diagram regen)
```

### B — Diff & classify

Read the old version (from Git if available, or current doc), compute the
diff:
- Added column → **additive**
- Removed column → **breaking**
- Renamed column → **rename** (most invasive)
- Changed type → **breaking** (data migration needed)

### C — Confirm with user

```
The change "add phone_alt column to occupant" touches 5 docs:
- modules/tenants/schema/schema-occupant.md  v1.0 → v1.1
- modules/tenants/module.md  v1.0 → v1.1
- modules/tenants/features/feature-occupant-register.md  v1.0 → v1.1
- shared/compliance-pii-inventory.md  v2.3 → v2.4
- architecture-overview.md  v1.2 → v1.3 (data-flow diagram regen)

Classification: additive
Is phone_alt PII? (likely yes since it's a phone number — confirm)

Proceed with the rewrites + log pointer?
```

### D — Rewrite affected files

Use Read + Edit + Write to update each file in place. Bump version in
frontmatter. Append row to local changelog table.

### E — Append pointer to changes-log.md

```markdown
## 2026-06-30T14:32:00Z — Added phone_alt column to occupant

**Code change**: `packages/db/src/schema/occupant.ts` lines 24-26
**Triggering migration**: `services/hasura/migrations/default/1717100000-add_occupant_phone_alt/up.sql`
**Change type**: additive
**Classification rationale**: new optional column, no breaking change

**Docs rewritten** (5):
- modules/tenants/schema/schema-occupant.md  v1.0 → v1.1
- modules/tenants/module.md  v1.0 → v1.1
- modules/tenants/features/feature-occupant-register.md  v1.0 → v1.1
- shared/compliance-pii-inventory.md  v2.3 → v2.4 (added phone_alt as PII)
- architecture-overview.md  v1.2 → v1.3 (data-flow regen)

**ADR triggered**: none
**Downstream actions required**:
- [x] pnpm db:generate
- [x] pnpm db:migrate
- [ ] Update OccupantForm component to include the new field
- [ ] Add to bulk-import column mapping
- [ ] Add to Zod schema in packages/api
```

### F — ADR if architectural

Only for changes that cross seams: swapping auth provider, changing storage
strategy, adding a new external service, abandoning an archetype. Most code
edits don't trigger this.

### G — Re-verify

Run `validate-docs.ts` scoped to the affected files. Report any new gaps.

## Special trigger patterns

### Bulk refactor

User says "rename column X to Y everywhere". This is a **rename**
classification — every file referencing the old name needs update. Run
`Grep -r "X"` to find references, then propagate. Single change-log entry
covers all rewrites.

### Schema migration

A new file in `services/hasura/migrations/default/<timestamp>/up.sql` is
always a trigger. The down.sql tells you the inverse — useful for
classification.

### Multi-edit session

If you make 10 code edits across one task (e.g. implementing a feature
end-to-end), you don't run change-tracking 10 times. Instead:

1. Make all the edits.
2. At the natural stopping point (before declaring "done"), run
   change-tracking ONCE covering all the cumulative changes.
3. Single change-log entry summarizing the whole feature implementation.

## What gates "next code edit"

After triggering change-tracking, the rule is: **docs must catch up before
the next unrelated task**. If user says "great, now do something else", you
must complete the change-tracking first. Politely refuse to switch context
until the docs are updated.

If user is in a rush, capture the deferred docs in a temp file
`docs/project/_temp/pending-doc-updates.md` with a TODO marker, and refuse
to declare the feature "done" until cleared.

## Anti-patterns to avoid

- **Silent edit then declare done.** Always log.
- **Batch a week of edits into one log entry.** Lose granular history.
- **Skip diagram regeneration.** Stale diagrams compound drift.
- **Mark "additive" when it's breaking.** Breaking changes need migration
  planning.
- **Skip ADR for archetypal shifts.** Future-you will not remember why.

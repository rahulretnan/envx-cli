# 17 — Spec-First Gate

When dev asks Claude Code to add/build/implement something, you MUST check
whether the spec exists in `docs/project/` before writing any code. If
there's no spec, you draft one (entering Phase 6) — you do NOT skip ahead
to coding.

This is the cardinal rule that prevents code-doc drift from day one.

## Trigger patterns

Any of these triggers the gate:

- "Add a feature for X"
- "Build the X module"
- "Implement Y endpoint"
- "Create a table for Z"
- "Wire up the Q workflow"
- "Add OAuth for Google"
- "Add a webhook for Razorpay"
- "Add a state machine for orders"
- "Code the export-to-PDF feature"

Anything that creates new functionality, not just modifies existing.

## Gate algorithm

### Step 1 — Identify the target module

From the request, infer which module(s) this belongs to:

- "occupant" → Tenants module
- "rent / payment / invoice" → Money module
- "warden / invitation" → Team module
- "audit" → Platform module
- ...

If ambiguous, ask the user: *"Which module does this belong to? (Tenants /
Money / Team / Operations / Platform / new module?)"*

### Step 2 — Check for spec existence

For each affected module:

```
Glob: docs/project/modules/<module>/features/feature-*.md
Glob: docs/project/modules/<module>/api/api-*.md
Glob: docs/project/modules/<module>/schema/schema-*.md
```

Match the feature name (or partial match) against existing files.

### Step 3 — Branch based on what exists

#### Branch A — Full spec exists

```
✓ Spec found: docs/project/modules/<m>/features/feature-<x>.md
✓ API spec: docs/project/modules/<m>/api/api-<x>.md
✓ Schema spec: docs/project/modules/<m>/schema/schema-<x>.md

Reading specs now to ground the implementation...
```

Then:
1. Read all three specs.
2. Confirm with user: *"Building per the spec. Key wiring: [recap from
   sequence diagram]. Proceed?"*
3. On confirmation, implement to match the spec exactly:
   - UI components match `module.md` page inventory
   - API procedures match `api/api-*.md` shapes + middleware order
   - DB tables match `schema/schema-*.md` columns + indexes
   - Validation matches Zod schemas in spec
   - Telemetry events fire as specified
   - File paths follow the "File-level paths" section of feature-*.md
4. After code is written, run code-edit change-tracking
   (`18-code-edit-triggers.md`) to update any spec details that changed
   during implementation (rare — but if you discovered a missed edge case
   while coding, document it).

#### Branch B — Partial spec exists

Some files exist (feature.md) but others don't (api.md, schema.md). Or
spec exists but missing critical sections (wiring diagram, edge cases,
state machine).

```
⚠️ Partial spec found:
  ✓ feature.md exists
  ✗ api.md MISSING
  ✗ schema.md MISSING
  ⚠ feature.md missing "End-to-End Wiring" section

I can't implement safely without these. Choices:
1. Fill the gaps now via spec interview (15-30 min) — Recommended
2. Implement the bits we know and document as we go (risky)
3. Show me what's missing in detail
```

Route based on reply. Option 1 enters Phase 6 starting from the missing
sub-steps.

#### Branch C — No spec exists

```
✗ No spec found for this feature.

Per project-docs-sync rules, we need a spec before code. Two options:
1. Walk the 20-step module deep-dive for this feature (Recommended) — this
   produces module.md / feature.md / api.md / schema.md / workflow.md /
   state-machine if needed. Takes 30-60 min depending on complexity.
2. Quick spec — fill only the critical sections (purpose, pages, actions,
   API procedures, schema, wiring, edge cases). Skips a11y/i18n/copy/perf/
   SEO. Takes 10-15 min. (Use only for very small features.)

Pick one, or describe a hybrid you'd prefer.
```

Route to Phase 6 from `05-module-decomposition.md`.

#### Branch D — New module entirely

If the feature implies a new top-level module (e.g. "add ratings & reviews"
to a project without one):

```
This is a new module. Adding it touches:
- docs/project/modules/<new-module>/  (full folder to create)
- docs/project/index/modules.md (add entry)
- docs/project/architecture-overview.md (module-map diagram regen)
- docs/project/CLAUDE.md (add to module table)

Want to:
1. Run the full module decomposition flow for this new module (Recommended).
   Takes 45-90 min. Output: complete module folder + updated index +
   regenerated module-map + ADR if architectural.
2. Skip the new module and instead extend an existing one (which one?)
3. Defer — I'll do this later
```

Route based on reply.

## What the gate refuses to do

Without an approved spec, you will NOT:

- Create `apps/<x>/src/app/.../page.tsx` for a new page
- Create `packages/api/src/routers/<x>.ts` for a new router
- Create `packages/db/src/schema/<x>.ts` for a new table
- Add new dependencies to `package.json`
- Write tests for unspecified behaviour
- Mock the existence of a doc that wasn't really written

If user pushes hard ("just write the code, I'll doc later"):

```
I hear you, but "doc later" is how every project ends up with CLAUDE.md
drift and a tests gap (you've seen this pattern in your own audits). Two
compromises:

1. Microspec mode — I write a minimal feature-<x>.md inline (purpose,
   pages, actions, wiring diagram, edge cases). Takes 5 min. Then implement.
2. Implement now, spec immediately after (within this session, before
   "done") — I'll generate the spec from the code I just wrote, and we'll
   review together.

Pick one. I'm not going to just write code untracked.
```

## What the gate explicitly allows

These don't need a fresh spec (still need code-edit change-tracking once
done):

- Bug fixes in existing features
- Refactors that preserve behaviour
- Copy/microcopy updates (still log via change-tracking)
- Adding tests for existing specs
- Performance optimization
- Dependency upgrades

## When to bypass the gate

The gate can be bypassed temporarily with explicit user instruction
("bypass spec-first gate for this task"). When bypassed:

1. State the bypass in your reply.
2. Track every untracked thing you write to a "spec debt" list in
   `docs/project/_temp/spec-debt.md`.
3. Refuse to declare "done" until the debt is cleared.

## After the spec is approved — offer the Asana story

Once a new feature spec is drafted and approved through this gate, offer:

> Spec approved. Want me to create the Asana user story for this feature too?
> (Uses your User Story Template — story header, Gherkin scenarios, WEESLD
> edge cases, [AC] subtasks. Takes a minute.)

If yes, load `22-asana-user-stories.md` and run the push flow for this one
feature. If Asana MCP isn't connected, write the story file to
`docs/project/modules/<m>/user-stories/` instead.

## Logging

Every gate decision is logged briefly to `docs/project/changes-log.md`:

```
## YYYY-MM-DDTHH:MM:SSZ — Spec-first gate fired

**Trigger**: "Add Aadhaar QR scanner to occupant form"
**Outcome**: Branch C (no spec) → user chose Option 1 (full module deep-dive)
**Resulting docs**: features/feature-aadhaar-scan.md, api/api-aadhaar.md, ...
**Implementation status**: pending
```

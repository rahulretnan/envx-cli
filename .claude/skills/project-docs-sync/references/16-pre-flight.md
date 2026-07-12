# 16 — Pre-flight (always-on session start)

Every Claude Code session in a project with `docs/project/` runs this before
anything else. Lightweight (a few file reads + two scripts) — call it
unconditionally.

## When this runs

- First user message in a fresh session
- After `cd <new-repo>` if the repo changed
- After `git checkout <other-branch>` if branch changed

## Steps

### Step 1 — Probe the repo

```
- Does the cwd have `docs/project/`?  (Glob: `docs/project/**/CLAUDE.md`)
- Does `CLAUDE.md` exist at project root?
- Does `package.json` exist?
- Does `.claude/skills/` exist?  (Find what's already installed)
```

### Step 2 — Read CLAUDE.md

If present, Read it fully. This file is the project's "stack provenance" —
archetype, modules, anti-patterns to avoid. Loading it informs every later
recommendation.

If absent, this is a greenfield repo. Skip to "no-docs branch" below.

### Step 3 — List modules

Read `docs/project/index/modules.md` if present, else Glob
`docs/project/modules/*/module.md`. Build a mental map of:
- Module names
- Owner roles
- Whether each is `Draft | Approved | Implemented`
- Most-recently-edited

### Step 4 — Run drift scan (background)

Run scripts (using Bash):

```bash
pnpm dlx tsx scripts/validate-docs.ts --json
pnpm dlx tsx scripts/audit-existing-project.ts --json
```

Or invoke the skill's bundled scripts directly from
`.claude/skills/project-docs-sync/scripts/`.

Parse output: `counts.P0`, `counts.P1`, `counts.P2`, plus per-file findings.

### Step 5 — Compare CLAUDE.md to reality

Specific checks beyond `audit-existing-project.ts`:

- Does CLAUDE.md claim a tech (Vitest, Playwright, Sentry, Drizzle, Hasura)
  that's not in `package.json`?
- Does CLAUDE.md claim file-based routing but no `apps/<x>/src/app/`?
- Does CLAUDE.md cite v0.5 but `package.json` says v0.8?
- Are there modules in `docs/project/modules/` not in the CLAUDE.md module
  table (or vice versa)?

### Step 6 — Compare `package.json` to recently-modified code

- Are there imports in code from packages NOT in `package.json`? (missing deps)
- Are there deps in `package.json` not imported anywhere? (dead deps)
- Are there schema files newer than the most recent migration?

### Step 7 — Produce a pre-flight report

Only show the report if there's anything to surface (don't spam empty reports).
Format:

```
📍 docs/project/ detected · <project-name>
Archetype: <A | B | C> + modifiers: <list>
Modules: <count> (<list of names, status-tagged>)

⚠️ Drift detected:
- P0 (3): <summaries>
- P1 (5): <summaries>
- P2 (12): <summaries>

⚠️ CLAUDE.md drift:
- <claim> vs <reality>

What would you like to do?
1. Fix drift now (Recommended if P0 > 0)
2. Continue with my task — ignore drift
3. Just give me a summary, no action
```

If no drift, simpler:

```
📍 docs/project/ detected · <project-name>  (<archetype>, <module-count> modules, no drift)
What would you like to do?
```

### Step 8 — Route based on user reply

| User intent | Route to |
|---|---|
| "Add feature/module X" | Spec-first gate (`17-spec-first-gate.md`) |
| "Modify column/route/role X" | Code-edit change-tracking (`18-code-edit-triggers.md`) |
| "Refactor / rename" | Code-edit change-tracking |
| "Audit docs" | Phase 10 verification (`09-verification-checklist.md`) |
| "Sync docs after refactor" | Code-edit change-tracking (in reverse) |
| "Feature X is done" | Validation gate (`19-validation-gate.md`) |
| "Design a new product" | Phase 1-12 (full flow — though rare in CC) |
| "Just tell me what you found" | Show the drift report only |

## No-docs branch (existing or greenfield repo)

If `docs/project/` doesn't exist, detect whether the repo has code:

- **Empty / minimal** (only README + package.json) → greenfield
- **Has code** (`apps/`, `packages/`, `src/`, `services/` populated) → existing

### If existing-with-code

```
📍 No docs/project/ here — but I see existing code:
   - <N> apps, <M> packages
   - Archetype inferred: <A | B | C> · confidence: <high | medium | low>
   - Modifiers detected: <list>

Three options:
1. **Reverse-engineer docs from your existing code (Recommended)** — I'll
   walk the code, infer modules and APIs and schemas, then interview you
   only for the bits code can't reveal (purpose, edge cases, telemetry).
   Takes 1-3 hours depending on size. See 21-reverse-engineer.md.
2. **Start fresh design, ignoring existing code** — for a rewrite. The
   existing code becomes irrelevant.
3. **Hybrid** — reverse-engineer what's already built, then design new
   features on top.
4. Skip docs entirely — just answer my immediate question (not recommended;
   doc drift will compound from day 1).

Reply with the number.
```

Route:
- 1 or 3 → load `21-reverse-engineer.md` and run that flow
- 2 → run normal Phase 1 (greenfield)
- 4 → answer current question only, but log to `docs/project/_temp/skipped-docs.md`

### If greenfield-empty

```
📍 No docs/project/ here yet.

What do you want to do?
1. **Design from scratch** (Recommended) — full 12-phase flow with
   one-question-at-a-time walkthrough. Generates docs, then can scaffold
   the code via BTS / shadcn-init / Amplify+Hasura.
2. Skip docs — just answer my immediate question.
```

Route based on reply.

## Performance / cost

Pre-flight should take <2 seconds for a repo with up to ~100 module docs.
Tools used:
- Glob (cheap)
- Read of CLAUDE.md (one file)
- Read of `docs/project/index/modules.md` (one file)
- Bash (validate-docs.ts + audit-existing-project.ts) — both fast

If `docs/project/` has >500 doc files, sample-and-summarize instead of
exhaustive read.

## Don't repeat pre-flight unnecessarily

Within a session, after pre-flight has run once, store the result mentally
(or write to a transient cache like `.claude/last-preflight.json`). Don't
re-run unless:
- User changes branch
- User runs `git pull` and sees new files
- User explicitly asks "rerun pre-flight"

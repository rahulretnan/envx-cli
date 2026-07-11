# 21 — Reverse-Engineer an Existing Codebase (Claude Code)

The Claude Code variant of reverse-engineer mode. Same overall flow as
Cowork's `16-reverse-engineer.md`, but adapted to take advantage of
Claude Code's aggressive file-reading + subagent capabilities.

## When this fires

Pre-flight (`16-pre-flight.md`) lands here when:
- The repo has code (`apps/`, `packages/`, `src/`, etc.)
- BUT `docs/project/` does not exist
- AND the user picked "document an existing codebase" in the pre-flight
  greeting

## Differences vs Cowork variant

Claude Code can do these things Cowork can't (use them):

1. **Aggressive parallel reads.** Spawn 4-8 subagents to read different
   modules in parallel. Each subagent reads ~20 files and returns a
   structured summary.

2. **Run shell.** `pnpm install`, `pnpm typecheck` to verify the code
   even builds before documenting it. `git log --oneline` to understand
   recent direction. `grep -r` for telemetry events / feature flags.

3. **Run validation scripts.** `validate-docs.ts` won't find anything
   (no docs yet), but `audit-existing-project.ts` gives the archetype +
   modifiers in one shot.

4. **Cross-reference imports.** Trace the actual import graph — UI →
   handler → service → DB — by following `from '@my-app/...'` references
   programmatically.

5. **Read test files for behavior.** Tests reveal intent better than
   production code. Read `*.test.ts` / `*.spec.ts` for documented
   expectations.

## Flow

### Step 1 — Static audit

```bash
pnpm dlx tsx .claude/skills/project-docs-sync/scripts/audit-existing-project.ts --json
```

Parse `audit-report.json`. Show user:

```
Detected archetype: A (Better-T-Stack) · confidence: high
Modifiers: Neon, LiveKit, Mastra, Dodopayments, Upstash
Apps: app, admin, web, mobile (4)
Packages: api, auth, db, email, env, cron, workers (7)

Confirm or correct before I dive in.
```

### Step 2 — Read foundation files

Read in this order:
- `package.json` (root)
- `README.md`
- `CLAUDE.md` (if exists)
- `pnpm-workspace.yaml`
- `bts.jsonc` / `amplify_outputs.json`
- `sst.config.ts` / `amplify/backend.ts`
- `Makefile`
- `.env.example`
- Each app's `package.json`
- Each package's `package.json`

Build mental context: archetype confirmed, deps cataloged, scripts known.

### Step 3 — File-tree map (parallel subagents)

Spawn parallel subagents — each reads one section:

| Subagent | Reads | Returns |
|---|---|---|
| A: Pages | `apps/*/src/app/**/page.tsx` + `apps/*/src/routes/**/*.tsx` | per-app page list with route → component imports |
| B: Routers | `packages/api/src/routers/*.ts` | procedure inventory with input/output Zod, middleware chain |
| C: Schema | `packages/db/src/schema/*.ts` OR `services/hasura/migrations/default/*` | table inventory with columns, indexes, constraints |
| D: Auth | `packages/auth/src/permissions.ts` + `packages/auth/src/index.ts` | role list, permission DSL, plugins |
| E: Workers | `packages/workers/src/handlers/*` + `packages/cron/src/handlers/*` + `amplify/functions/**` | job inventory with triggers + idempotency |
| F: Webhooks | `apps/*/src/app/api/webhooks/*/route.ts` + REST `/api/v1/**` | handler inventory with signature schemes |
| G: UI components | `apps/*/src/components/**` | component inventory with prop types + role gates |
| H: Tests | `**/*.test.ts` + `**/*.spec.ts` + `e2e/**` | critical-path coverage + intent reveals |

Each subagent returns a structured markdown block. You compose them.

### Step 4 — Propose module grouping

Same logic as Cowork variant. Group pages by URL prefix → suggest modules.
Show user, get confirmation.

### Step 5 — Per-module reverse-engineer

For each module, again use a subagent (one per module if there are >3).
Each subagent:

1. Reads all files in that module's slice (pages + components + procedures
   + tables + workers)
2. Builds the 20-step inference (purpose, pages, UI, actions, API, schema,
   wiring, state, events, edges-from-code, states-rendered, telemetry,
   a11y, i18n, flags, responsive, copy, URL state, perf, SEO)
3. Returns a draft `module.md` content + draft `feature-*.md` content per
   feature found

Then YOU walk through with the user — confirm inferences, fill the gaps
the code couldn't reveal (purpose, edge case INTENT, telemetry PLAN, etc.).

### Step 6 — Generate the docs

Use the 29 templates in `assets/templates/`. For each generated doc:

- Frontmatter `Status: Implemented` (code already exists)
- `Last Updated: <today>`
- `Version: 1.0`
- Add a callout in each module.md:
  ```markdown
  > **Source:** Reverse-engineered from existing code on <date>.
  > Sections marked *(inferred from code)* came from automated analysis;
  > sections marked *(confirmed by owner)* came from the interview.
  ```

### Step 7 — Generate the initial `changes-log.md` entry

```markdown
## YYYY-MM-DDTHH:MM:SSZ — Initial reverse-engineering from existing code

**Change type**: initial-reverse-engineer
**Triggered by**: project-docs-sync (Claude Code) reverse-engineer mode
**Code-state snapshot**:
- Archetype: A · modifiers: Neon, LiveKit, Mastra, Dodopayments
- Apps (4): app, admin, web, mobile
- Packages (7): api, auth, db, email, env, cron, workers
- Pages: 27 across all apps
- API procedures: 47 (oRPC)
- DB tables: 23
- Workers: 8 (QStash) + 5 (SST Cron)
- Webhooks: 3 incoming, 0 outgoing
- Modules grouped into: Identity, Tenants, Money, Team, Operations, Platform

**Docs generated**: <count> files (see `index/*.md` for listings)
**ADRs back-filled** (10): 0001-archetype, 0002-auth, ..., 0010-region

**Inferred-not-confirmed sections**:
- Edge-case intent (interview filled most, some marked TBD)
- Telemetry plan (existing events documented; gaps flagged)
- Performance budgets (no SLO in code; user set targets)

**Verification report (Phase 10)**: <run output summary>
```

### Step 8 — Run Phase 10 verification

Run `validate-docs.ts` against the freshly-generated docs. There will be
gaps (this is the first time docs exist). Present the report — user picks
which to fix now.

### Step 9 — Hand off to change-tracking

After verification + refinement complete, the project enters normal mode.
Any further code edit triggers `18-code-edit-triggers.md`. Any further
intent change triggers `11-change-tracking.md`. Reverse-engineer mode is
one-shot.

## Aggressive code analysis tactics

### Detect side-effects automatically

Grep for these patterns to find side-effects you'd otherwise miss:

```bash
grep -r "publishJSON" packages/api/ apps/        # QStash producers
grep -r "posthog.capture\|track(" .              # Telemetry
grep -r "Sentry.capture" .                       # Sentry events
grep -r "emit(\|dispatch(" .                     # Event emission
grep -r "scheduler.send\|createSchedule" .       # EventBridge
grep -r "redis.set" .                            # Cache writes
```

Each match becomes a documented side-effect in the relevant feature.md.

### Detect feature flags

```bash
grep -r "featureFlag\|isFeatureEnabled\|growthbook\|launchdarkly" .
```

Document each flag with: name, default state, where it gates, fallback.

### Detect role gates

```bash
grep -rE "\.role.{0,20}===\s*['\"][a-z]+" .         # role string checks
grep -r "assertPermission\|requireRole" .           # explicit guards
grep -r "memberRole\|activeOrganizationId" .        # tenancy context
```

Cross-reference with `packages/auth/src/permissions.ts`. If code uses a
role that's not in the permissions file (or vice versa), flag as drift.

### Detect Zod schemas

```bash
grep -r "z\.object({" packages/api/             # Input schemas
```

Read each `z.object(...)` and document field-by-field in api-*.md.

### Detect telemetry naming

Capture every `track('xxx')` or `posthog.capture('xxx')`. Sort & dedupe.
The resulting list is your existing telemetry catalog. Compare against
the `observability.md` template's "telemetry events" section.

## Tips

- **Read tests first** for any module — they reveal intent better than
  production code.
- **Confirm the inferred ERD with the user** before committing to docs.
- **Mark inferences vs confirmations** in generated docs so future readers
  can tell.
- **Don't over-document.** Dead/abandoned code → ask user before documenting.
- **Don't fabricate.** Better to leave `<TBD>` than invent.

## When reverse-engineer fails / partial

If parts of the code are too tangled to reverse-engineer cleanly:
- Document what you CAN
- Flag the rest in `docs/project/_temp/reverse-engineer-gaps.md`
- Surface these on every subsequent pre-flight until cleared

## Hybrid mode (existing + new)

If user said "hybrid" at pre-flight (document existing + design new):

1. Run reverse-engineer for existing modules (Steps 1-7)
2. Verify (Step 8)
3. Then enter normal Phase 5 (module inventory) for the NEW modules
4. For each new module → Phase 6 deep dive as normal

Both modes can co-exist in one project — the changes-log distinguishes.

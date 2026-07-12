# 19 — Validation Gate (implementation-vs-spec parity)

When dev claims a feature or module is "done", you must verify the
implementation actually matches the spec. This gate is the last defence
against shipping incomplete or drifted code.

## When this fires

- User says "feature X is done"
- User says "I'm ready to merge / open PR"
- User says "ship this"
- User runs CI and asks if it's safe to merge
- After completing a feature implementation in the same session (auto-fire)

## Validation checklist

For each section of the relevant `module.md` and `feature.md`, verify the
code matches.

### A — Pages exist

For each page in `module.md` Pages table:

- [ ] `apps/<x>/src/app/<route>/page.tsx` exists (or framework-equivalent)
- [ ] Page has the documented layout shape (list / detail / form)
- [ ] Page has the documented sub-components
- [ ] Page enforces the documented role gates (server-side)

### B — UI components exist

For each component listed in `module.md` UI Components section:

- [ ] Component file exists at expected path
- [ ] Component renders the documented elements (buttons, inputs, etc.)
- [ ] Component handles all documented states (empty / loading / error / offline)

### C — Actions wired

For each action in `module.md` Actions table:

- [ ] Trigger UI element exists
- [ ] Calls the documented API procedure
- [ ] Permission gate matches the role × action matrix
- [ ] Telemetry event fires (search code for the event name)
- [ ] Side-effects are wired (event emission, job enqueue, email send)

### D — API procedures implemented

For each procedure in `api/api-*.md`:

- [ ] Router function exists in `packages/api/src/routers/`
- [ ] Input shape matches the documented Zod schema
- [ ] Output shape matches
- [ ] Middleware chain matches (auth → tenancy → permission → rate-limit → captcha → handler)
- [ ] Error taxonomy implemented (each documented error code can actually fire)
- [ ] Rate limit configured if documented
- [ ] Idempotency check if mutation

### E — DB schema matches

For each table in `schema/schema-*.md`:

- [ ] Table exists in Drizzle schema (Archetype A) or Hasura migrations (Archetype B)
- [ ] All documented columns present with correct types
- [ ] All documented indexes present (with purpose justified)
- [ ] All documented constraints present (CHECK, UNIQUE, partial UNIQUE)
- [ ] Foreign keys match
- [ ] Soft-delete column if documented
- [ ] Audit columns if documented
- [ ] PII fields tagged in `compliance.md`

### F — State machines

For each state machine in `state-machines/status-*.md`:

- [ ] Every state implemented as an enum value
- [ ] Every transition has a code path
- [ ] Every guard implemented
- [ ] Every side-effect fires on the right transition
- [ ] Invalid transitions return the documented error

### G — Async jobs

For each job in `async-jobs/job-*.md`:

- [ ] Handler file exists at documented path
- [ ] Trigger is wired (QStash producer, EventBridge schedule, S3 notification, etc.)
- [ ] Idempotency check implemented
- [ ] Retry policy matches documentation
- [ ] DLQ configured
- [ ] Telemetry events fire (start, success, failure)

### H — Webhooks (if applicable)

For each webhook handler:

- [ ] Signature verification implemented
- [ ] Idempotency check (Redis SET NX EX)
- [ ] Per-event-type router
- [ ] Replay window enforced
- [ ] Side-effects fire only on first delivery

### I — Edge cases

For each edge case in `feature.md` Edge Cases section:

- [ ] Code path exists for the scenario
- [ ] Either a test exists OR the path is verifiable by code reading

(This is the weakest check — true coverage requires actual tests.)

### J — Telemetry / observability

For each telemetry event in `observability.md`:

- [ ] Event name fires somewhere in code (Grep for the exact name)
- [ ] Props match what's documented
- [ ] Fires on the documented trigger (success / failure / both)

For each alert / dashboard mentioned:

- [ ] Either configured in code or noted as "manual ops setup needed"

### K — Permissions

For each row in `rbac-matrix.md`:

- [ ] Permission enforced in middleware OR procedure body
- [ ] Permission table in `packages/auth/permissions.ts` matches the matrix
- [ ] No duplicate inline permission checks (drift risk)

### L — i18n keys

If module has i18n:

- [ ] Every documented key exists in translation files
- [ ] No hardcoded strings in components that should be translated

### M — Compliance / PII

For each PII field:

- [ ] Tagged in `compliance.md`
- [ ] Encryption at rest implemented if "sensitive" or "restricted" tier
- [ ] Logged-but-redacted (Sentry beforeSend / pino redact config)
- [ ] Deletion handler covers this field
- [ ] Access log records reads (if required)

### N — Tests exist for critical paths

For each path in `test-plan.md` critical paths:

- [ ] Test file exists at expected path
- [ ] Test name matches the documented scenario
- [ ] Test runs (Bash: `pnpm test --filter ...` and check no skips)

### O — Diagrams accurate

- [ ] Sequence diagrams in `feature.md` match actual call chain (sanity-check by reading)
- [ ] Component diagrams in `module.md` include any new pages/components
- [ ] State machine diagrams are current

## Report format

```
# Validation report — <feature/module> · <date>

Coverage: <%>  ·  Pass: <n>  ·  Fail: <n>  ·  Skip: <n>

## ❌ Failures (blockers — must fix before "done")

### A. Pages exist
- [ ] `/occupants/[id]` page missing
- [ ] `/occupants/new` page exists but missing AadhaarScanner subcomponent

### D. API procedures
- [ ] `occupant.bulk-import` procedure not implemented (documented in api/api-occupant.md)
- [ ] `occupant.export` procedure exists but missing rate limit (api/api-occupant.md says 5/hour)

### J. Telemetry
- [ ] Event `occupant.created` never fires (documented but no posthog.capture call)
- [ ] Event `occupant.bulk_import.started` never fires

### K. Permissions
- [ ] `vacate` action allowed to Warden-Write in code, but matrix says Owner-only

## ⚠️ Warnings (should fix)

### I. Edge cases
- "Concurrent vacate by two users" — no code path found
- "Offline draft submission" — feature.md documents but no code

## ✓ Passed
- All UI components exist
- Schema matches Drizzle
- State machine implemented
- DLQ configured
- ...
```

## Resolution flow

```
Validation result: 4 blockers, 2 warnings

Want to:
1. Fix all blockers + warnings now (Recommended before declaring done)
2. Fix blockers only — defer warnings
3. Override (force "done" status) — needs a reason logged to changes-log

Pick one.
```

If user picks Override:
- Log to changes-log with `change_type: validation-override`
- Capture the unresolved items in `docs/project/_temp/known-gaps.md` so
  they surface in next pre-flight
- Refuse to mark module status as "Implemented" — stays at "Draft"

## Filing validation failures as bugs

For failures that are BROKEN BEHAVIOUR in shipped/running code (not
missing implementation), offer to file each as an Asana bug via
`23-asana-bug-reports.md`:

> 2 of these failures are defects in behaviour that already shipped
> (permission gap on `vacate`, wrong error copy on bulk import). Want me to
> file them as bugs in your QA Bug Report format? Expected result, steps,
> module, and acceptance criteria come from the spec — I'll only need
> environment + build from you.

Missing-implementation gaps stay in the validation report; only real
defects become bug tickets. One bug per defect.

## Asana story AC-ticking (if stories exist)

If `docs/project/asana.json` has a storyRegistry entry for this feature:

1. Fetch the story's `[AC]` subtasks (`asana_get_task` on the story gid,
   subtasks included)
2. Map each AC to its validation category (happy path → C, error state → I,
   permission boundary → K, limits → I, empty state → B, i18n → L)
3. For each AC whose category PASSED: offer to mark complete via
   `asana_update_task` (completed: true)
4. For each AC whose category FAILED: leave open, reference the gap in the
   validation report
5. Never auto-complete the parent story task — the human closes it

## Auto-fire on session-end

If user is wrapping a coding session (says "thanks", commits, closes), and
they implemented a feature this session, fire validation automatically
before they leave. Better to catch gaps now than next sprint.

## Integration with code-edit change-tracking

Validation can find gaps that weren't surfaced during change-tracking (e.g.
you updated docs but forgot a code path). When validation flags a missing
code path, it loops back into spec-first gate (`17-spec-first-gate.md`)
to either:
- Add the missing code (if spec is right)
- Update the spec to match reality (if spec was wrong)
- Document the deferred work explicitly

Either way, no silent skipping.

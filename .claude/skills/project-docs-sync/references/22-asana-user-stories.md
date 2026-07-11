# 22 — Asana User Stories

Generate one Asana user story per feature, in the org's standard "User Story
Template" format, filled entirely from the docs the skill already produced.
The story is product-facing (the WHAT and WHY); the docs remain the
engineering source-of-truth (the HOW).

## When this runs

- **Phase 9 (Generation), optional step.** After docs are written, ask:
  > Docs are generated. Want me to also create Asana user stories — one per
  > feature — in your User Story Template format? I can:
  > 1. **Push directly to Asana** (Recommended if Asana MCP is connected) —
  >    creates one task per feature with [AC] subtasks
  > 2. **Write story files to docs/** — `docs/project/modules/<m>/user-stories/`
  >    as markdown you can paste later
  > 3. Skip
- **Spec-first gate (17-spec-first-gate.md).** When a new feature spec is
  drafted through the gate, after the spec is approved offer: "Want me to
  create the Asana user story for this feature too?"
- **Change-tracking (18-code-edit-triggers.md).** When a feature doc changes
  materially (new scenario, new edge case, scope change, copy change), the
  corresponding story is stale. Step A of the change protocol must list the
  story as an affected artifact; offer to update the Asana task (or the
  story file).
- **Validation gate (19-validation-gate.md).** When validating "done", if
  the story exists, check each [AC] subtask maps to verified behaviour;
  offer to tick completed ACs via `asana_update_task` (completed: true).
- **On demand.** User says "create user stories", "push stories to Asana",
  "generate story for feature X".

## Prerequisites check

1. Asana MCP available? (tools named `asana_*` / `mcp__*asana*`) If not,
   fall back to story files and tell the user how to connect Asana.
2. Ask once per project (then store in `docs/project/asana.json`):
   - Which Asana **project** to create stories in
   - Which **section** (optional)
   - Whether to link stories back to spec files via URL (repo URL prefix)

```json
// docs/project/asana.json
{
  "workspace": "<gid>",
  "project": "<gid>",
  "section": "<gid | null>",
  "specUrlPrefix": "https://github.com/<org>/<repo>/blob/main/",
  "storyRegistry": {
    "<module>/<feature-slug>": { "taskGid": "<gid>", "lastSyncedVersion": "1.2" }
  }
}
```

`storyRegistry` maps each feature to its Asana task so change-tracking can
update rather than duplicate.

## The template (verbatim structure — keep numbering, including the 9 → 11 skip)

Every story task has:
1. **Title** = the STORY line (short imperative, e.g. "Reset a forgotten password")
2. **Description** (`html_notes`) = the filled template below
3. **Subtasks** = acceptance criteria, each prefixed `[AC]`

## Field mapping — docs → story

Everything comes from docs already generated. Never invent content; if a
doc section is missing, leave the placeholder with `TBD` and flag it.

| Story section | Source in docs |
|---|---|
| STORY title | `feature-*.md` name, rephrased imperative |
| Surface(s) | `module.md` Pages table + distribution cross-cut (web/mobile/admin/API) |
| Actor / role | `feature-*.md` User Stories roles |
| Who is allowed / not allowed | `module.md` Role × Action matrix row(s) for this feature |
| Priority — Type | `feature-*.md` Requirements (Must=P0, Should=P1, Nice=P2) — Type: new feature unless doc says enhancement/change/fix |
| Depends on / related | `feature-*.md` Dependencies section |
| 1. User story | `feature-*.md` User Stories (primary one) |
| 2. Context / why | `feature-*.md` Problem Statement (1-3 lines) + link to spec |
| 3. Scenarios (Gherkin) | Derived from `feature-*.md` User Flow (happy path) + `workflow-*.md` Alternative Paths + Failure Scenarios. GIVEN = preconditions, WHEN = trigger, THEN/AND = outcomes |
| 4. Business rules & logic | `feature-*.md` Business Rules + validation constraints from schema |
| 5. Data & entities | `schema-*.md` tables touched; CRUD from Actions table; new/changed fields |
| 6. WEESLD | Map from docs: Waiting = Loading state · Empty = Empty state · Error = Error states + edge cases (validation/network/permission/server with exact copy) · Success = success toast/redirect copy from Copy library · Limits = Boundary edge cases (min/max/rate limits) · Defaults = default values/sort/filter from module.md |
| 7. UI / UX, copy & i18n | `module.md` Copy library (exact strings) + Accessibility section + design links if present |
| 8. Side effects | `feature-*.md` wiring side-effects: emails (email templates), push/in-app (notifications), background jobs (async-jobs), analytics events (observability.md telemetry) |
| 9. Out of scope / non-goals | `feature-*.md` Scope → Out of Scope (at least one item) |
| 11. Technical context | `feature-*.md` File-level paths (layers touched), schema entities/endpoints, migration yes/no, NFR flags. In Claude Code, VERIFY against actual code before filling — this is the one section the code answers better than the docs |
| 12. References | Links: spec file URL, design links, related task URLs, external docs |
| [AC] subtasks | See below |

## Acceptance criteria → subtasks

Generate one `[AC]` subtask per independently-verifiable criterion. Minimum
coverage (mirror the template's default set, extend as needed):

- `[AC] Happy path — <the main success behaviour, specific>`
- `[AC] Error state — <exact message + recovery action>` (one per distinct failure class)
- `[AC] Empty / first-time state — <what shows>` (if applicable)
- `[AC] Limits — <min/max/file size/rate-limit behaviour>` (if applicable)
- `[AC] Permission boundary — <who is blocked, enforced server-side>`
- `[AC] i18n — all user-facing strings localized, none hardcoded` (only if project is multi-language)
- Plus one `[AC]` per business rule that must be enforced server-side
- Plus one `[AC]` per WEESLD row that has real behaviour (not N/A)

Rule of thumb: 5-12 subtasks per story. If more than 12, the feature is too
big — suggest splitting into multiple stories.

## Asana HTML rules (html_notes)

Asana accepts a restricted HTML subset, NOT markdown. When pushing via MCP
(`asana_create_task` with `html_notes`):

- Allowed: `<h1> <h2> <strong> <em> <u> <s> <code> <pre> <blockquote> <ol> <ul> <li> <a href> <hr />`
- NOT allowed in task descriptions: `<h3>+` (use `<h2>`), `<table>` (use lists), `<img>` in comments
- Body must be wrapped in `<body>...</body>`
- No `<br/>` — use separate block elements
- Escape `& < >` in text content

### Story description skeleton (fill placeholders from docs)

```html
<body><h2>Story header</h2><ul>
<li><strong>STORY:</strong> {title}</li>
<li><strong>Surface(s):</strong> {surfaces}</li>
<li><strong>Actor / role:</strong> {roles}</li>
<li><strong>Who is allowed / not allowed:</strong> {permission rule}</li>
<li><strong>Priority:</strong> {P0|P1|P2} — <strong>Type:</strong> {new feature|enhancement|change|fix}</li>
<li><strong>Depends on / related:</strong> {deps}</li></ul><hr />
<h2>1. User story</h2><blockquote>As a <em>{role}</em>, I want to <em>{action}</em>, so that <em>{benefit}</em>.</blockquote>
<h2>2. Context / why</h2><blockquote>{1-3 lines + spec link}</blockquote>
<h2>3. Scenarios (Gherkin)</h2>
<ul><li><strong>Scenario:</strong> {name}</li>
<li><strong>GIVEN</strong> {preconditions}</li>
<li><strong>WHEN</strong> {trigger}</li>
<li><strong>THEN</strong> {outcome}</li>
<li><strong>AND</strong> {further outcomes}</li></ul>
<h2>4. Business rules &amp; logic</h2><ul><li>{rule}</li></ul>
<h2>5. Data &amp; entities</h2><ul>
<li><strong>Entities touched:</strong> {entities}</li>
<li><strong>CRUD:</strong> {operations}</li>
<li><strong>New or changed fields:</strong> {fields}</li></ul>
<h2>6. Edge cases — WEESLD</h2><ul>
<li><strong>Waiting</strong> - {loading UI}</li>
<li><strong>Empty</strong> - {empty state}</li>
<li><strong>Error</strong> - {failures + exact copy + recovery}</li>
<li><strong>Success</strong> - {confirmation + exact copy}</li>
<li><strong>Limits</strong> - {min/max/rate limits}</li>
<li><strong>Default values</strong> - {defaults}</li></ul>
<h2>7. UI / UX, copy &amp; i18n</h2><ul>
<li><strong>Designs:</strong> {links or description}</li>
<li><strong>User-facing copy:</strong> {exact strings}</li>
<li><strong>Accessibility / responsive notes:</strong> {notes}</li></ul>
<h2>8. Side effects</h2><ul>
<li><strong>Emails:</strong> {emails or none}</li>
<li><strong>Push / in-app notifications:</strong> {notifications or none}</li>
<li><strong>Background jobs / queue / cache:</strong> {jobs or none}</li>
<li><strong>Analytics events:</strong> {events or none}</li></ul>
<h2>9. Out of scope / non-goals</h2><ul><li>{item}</li></ul>
<h2>11. Technical context</h2><ul>
<li><strong>Layers touched:</strong> {layers}</li>
<li><strong>Suspected entities / endpoints:</strong> {list} — <strong>Migration needed:</strong> {yes/no}</li>
<li><strong>Non-functional flags:</strong> {flags}</li></ul>
<h2>12. References</h2><ul>
<li><strong>Spec / PRD:</strong> <a href="{specUrl}">{feature file}</a></li>
<li><strong>Designs:</strong> {links}</li>
<li><strong>Related tasks:</strong> {links}</li>
<li><strong>External docs:</strong> {links}</li></ul></body>
```

## Push flow (Asana MCP available)

For each feature, in module order:

1. Compose title + html_notes + subtask list from docs
2. `asana_create_task` (project + section from `asana.json`, `html_notes`)
3. For each AC: `asana_create_task` with `parent` = story gid (or
   `asana_set_parent_for_task`) — name prefixed `[AC]`
4. Record `{ taskGid, lastSyncedVersion }` in `asana.json` storyRegistry
5. Set dependencies between stories via `asana_set_task_dependencies` when
   `Depends on` references another generated story
6. Report per module: `✓ 5 stories created (32 ACs) → <project name>`

Batch politely: create stories module-by-module and confirm between modules
if there are more than ~15 stories total.

## File flow (no Asana MCP)

Write one file per story: `docs/project/modules/<m>/user-stories/story-<slug>.md`
using `assets/templates/user-story.md`. Include a ready-to-paste plain-text
version AND note the [AC] list. Tell the user these can be pushed later by
reconnecting Asana and saying "push user stories to Asana".

## Change-tracking integration

Add to the Step-A mapping table (11-change-tracking.md + 18-code-edit-triggers.md):
any change to `feature-*.md`, its workflows, edge cases, copy, or permissions
ALSO touches `user-stories/story-<slug>.md` and (if pushed) the Asana task.
On confirm:

- Regenerate the story content
- If pushed: `asana_update_task` with new `html_notes`; add a comment
  (`asana_create_task_story`) summarising what changed and why (link the
  changes-log entry). Do NOT delete/recreate completed AC subtasks — add new
  ACs for new criteria and comment on obsolete ones instead.
- Bump `lastSyncedVersion` in `asana.json`

## Validation gate integration (Claude Code only)

During the "done" check (19-validation-gate.md), if a story exists for the
feature:

1. For each `[AC]` subtask, map it to the corresponding validation category
   (happy path → C actions wired, error state → I edge cases, permission
   boundary → K permissions, etc.)
2. If the validation category passed, offer to mark the AC complete via
   `asana_update_task` (completed: true)
3. If validation failed, leave the AC open and reference the gap in the
   validation report
4. Never auto-complete the story parent task — the human closes it

## Quality bar

- Exact copy strings, not paraphrases ("Couldn't save changes. Try again."
  — not "an error toast").
- Every WEESLD row filled; "N/A" is valid but must be deliberate.
- Every permission boundary from the RBAC matrix that applies to this
  feature appears in the story AND as an [AC].
- At least one out-of-scope item.
- Do not include the template's instructional hints — output filled content.
- Numbering matches the template verbatim (9 → 11 skip preserved).

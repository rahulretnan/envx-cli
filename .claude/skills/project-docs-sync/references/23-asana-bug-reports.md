# 23 — Asana Bug Reports

File bugs to Asana in the org's standard "QA Bug Report Template" format.
The skill pre-fills everything the docs already know (module, expected
behaviour, roles, steps, acceptance criteria); the human supplies only what
happened in the real world (actual result, evidence, build, environment).

## When this runs

- **On demand.** User says "file a bug", "report this bug", "create a bug
  ticket", "X is broken — log it".
- **Validation gate (19-validation-gate.md).** Failures that are broken
  behaviour in shipped code (not missing implementation) → offer to file
  each as a bug. One bug per defect.
- **Debug sessions.** After diagnosing a defect the user reported in chat,
  offer: "Root cause found. File this as a bug before/while we fix it?"
  The diagnosis fills Steps/Expected/Actual precisely.
- **Phase 10 verification / reverse-engineer audit.** Broken behaviour
  discovered while auditing → offer to file. Doc gaps stay in the gap
  report; only real defects become bug tickets.
- **User pastes a bug description.** Parse it into the template, ask only
  for the missing fields, then file.

## Prerequisites

Same `docs/project/asana.json` as user stories (see the user-stories
reference), extended with bug config:

```json
{
  "bugs": {
    "project": "<gid>",
    "section": "<gid | null>",
    "priorityTags": {
      "high": "<tag gid — e.g. 'High Priority-Bug-<Project>'>",
      "medium": "<tag gid>",
      "low": "<tag gid>"
    },
    "retestFailedTag": "<tag gid — applied when a fix fails retest>"
  }
}
```

Tag names are project-specific — ask once, store, reuse.

## What the skill pre-fills from docs (never ask the user for these)

| Bug section | Source |
|---|---|
| 3. Feature/Module | Map the broken behaviour to `modules/<m>/` — from module inventory |
| 7. Test Data — Role used | RBAC matrix roles relevant to the flow |
| 8. Steps to Reproduce | `workflow-*.md` happy path steps up to the failure point |
| 9. Expected Result | **The spec IS the expected behaviour** — quote the exact line from `feature-*.md` / workflow / copy library |
| 13. Acceptance Criteria | Expected result + adjacent behaviour from the spec that must keep working (other roles from RBAC matrix, other WEESLD states, related workflows) |
| Title `[Platform]` | From module surfaces (web app / mobile / admin / API) |

## What only the human supplies (ask one at a time, skip what they gave)

1. **Actual result** — exact error text if any
2. **Environment** — Local / Staging / Production + build/version + device/OS + browser + observed-at (date, time, timezone)
3. **Evidence** — Jam.dev link (best) / video / screenshots + console + failed request
4. **Reproducibility** — Always / Often (~n/10) / Rarely / Once
5. **Regression check** — worked before? last known good build? new feature or regression?
6. **Priority** — High / Medium / Low (business call; skill suggests from severity but never decides)
7. **Workaround** — if any

## Severity heuristic (skill recommends, human confirms)

- **S1 Blocker** — core flow impossible, crash, data loss, security issue
- **S2 Major** — important feature broken, no reasonable workaround
- **S3 Minor** — partially broken or has a workaround
- **S4 Cosmetic** — visual / copy only, no functional impact

Severity ≠ Priority (different axes — a homepage-hero typo can be S4 + High).
Bug Type: **UI** (visual/layout/copy) / **Functional** (behaviour wrong) /
**Improvement** (works as built, should be better — severity/regression may
not apply).

## Title format

`[Platform][Severity] Short what + where`
e.g. `[Mobile/iOS][S1] Sign-in hangs after Google OAuth`

## The task structure

1. **Title** = format above
2. **Description** (`html_notes`) = filled template (skeleton below)
3. **Tags** = priority tag from `asana.json`; add `retestFailedTag` when a fix fails retest
4. No subtasks by default — ACs live in section 13 as a checklist (unless the org prefers `[AC]` subtasks; ask once, store in asana.json as `"bugAcAsSubtasks": true|false`)

## html_notes skeleton (Asana HTML subset — same rules as user stories)

```html
<body><h2>1. Summary</h2>{one sentence: what's broken, where, for whom}
<h2>2. Bug Type</h2>{UI | Functional | Improvement}
<h2>3. Feature/Module</h2>{module} — <a href="{specUrl}">{feature spec}</a>
<h2>4. Severity</h2>{S1 Blocker | S2 Major | S3 Minor | S4 Cosmetic} — {one-line justification}
<h2>5. Priority</h2>{High | Medium | Low}
<h2>6. Environment</h2><ul>
<li>Platform: {Web (which app) | Mobile iOS/Android | API}</li>
<li>Environment: {Local | Staging | Production}</li>
<li>URL / screen: {exact}</li>
<li>Build / version: {observed in} (latest: {latest if different})</li>
<li>Device / OS: {device + version}</li>
<li>Browser: {browser + version, web only}</li>
<li>Observed at: {date, time, timezone}</li></ul>
<h2>7. Test Data</h2><ul>
<li>Role used: {role}</li>
<li>Test account(s): {accounts}</li>
<li>Data state: {relevant state}</li></ul>
<h2>8. Steps to Reproduce</h2><ol>
<li>{step}</li><li>{step}</li><li>{step}</li></ol>
Reproducibility: {Always | Often ~n/10 | Rarely | Once}
<h2>9. Expected Result</h2>{single correct outcome — quoted from spec}
<h2>10. Actual Result</h2>{what happened — exact error text}
<h2>11. Evidence</h2><ul><li>{Jam.dev link / video / screenshots + console + failed request}</li></ul>
<h2>12. Regression Check</h2><ul>
<li>Worked before: {Yes | No | Unknown}</li>
<li>Last known good: {build or date}</li>
<li>{New feature | Regression}</li></ul>
<h2>13. Acceptance Criteria — Done when</h2><ul>
<li>{testable condition}</li>
<li>{adjacent behaviour that must keep working — other roles/plans/flows}</li></ul>
<strong>Dev fills before handing back to QA: Fixed in build / version ___</strong>
<h2>14. Workaround</h2>{workaround or "none"}</body>
```

## Pre-submit checklist (skill enforces before pushing)

- One bug per ticket — if the user described 2+ unrelated issues, split them
- Type + Severity + Priority set
- Build/version + environment filled
- Role + test account(s) provided
- Steps reproduce from a clean start (deterministic)
- Both Expected AND Actual stated
- At least one piece of evidence attached (or explicitly waived by user)
- Acceptance criteria defined (incl. adjacent behaviour)

If any check fails, ask for the missing piece — don't push an incomplete bug.

## Push flow

1. Compose title + html_notes
2. `asana_create_task` into `bugs.project` / `bugs.section`
3. Apply the priority tag
4. If related to a generated user story, link via `asana_set_task_dependencies`
   or mention the story URL in section 3
5. Report: `✓ Bug filed: [Web][S2] … → <project>` with URL

No Asana MCP → write `docs/project/_bugs/bug-<slug>.md` from
`assets/templates/bug-report.md` and tell the user it can be pushed later.

## Retest flow

When the user says a fix failed retest: add the `retestFailedTag` to the
existing task + comment (`asana_create_task_story`) with the new actual
result + build — never open a duplicate.

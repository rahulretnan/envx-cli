# Changes Log

Source-of-truth for every doc change after initial generation. Append-only.
Newest at the top.

This is the **pointer log** — short summaries that reference the actual rewritten
files. The files themselves carry their own local changelog tables.

## Format

```markdown
## YYYY-MM-DDTHH:MM:SSZ — <one-line summary>

**Change type**: initial-reverse-engineer | additive | breaking | rename | removal | architectural | typo | copy
**Triggered by**: <user request / discovery / audit>

**Files rewritten** (N):

- `<path>` v<X> → v<Y>

**ADR triggered**: <NNNN-slug.md> | none
**Downstream actions required**:

- [ ] <action>
```

---

## 2026-07-13 — Update note + tip after commands (`printAdvisories`)

**Change type**: additive
**Triggered by**: update-note-and-tips feature implementation — spec
`docs/superpowers/specs/2026-07-13-envx-update-note-and-tips-design.md`, plan
`docs/superpowers/plans/2026-07-13-envx-update-note-and-tips.md`

**Code changes documented**: new `src/utils/update-check.ts` (npm registry
version check with a 24h-throttled cache at `~/.envx/update.json`, semver
compare, fire-and-forget detached background refresh via a `--update-worker`
child process) and `src/utils/hints.ts` (`shouldShowHints`, a rotating `TIPS`
list, `pickTip`, and the `printAdvisories(opts, current)` orchestrator);
`main()` in `src/index.ts` now calls
`printAdvisories(program.opts(), packageJson.version)` right after
`program.parseAsync(process.argv)` inside the existing `try` block. Advisories
print a dim one-line update note (only when a newer version is cached) plus
one random `💡` tip, but only when interactive: suppressed when
`!process.stdout.isTTY`, `process.env.CI`, `--quiet`, or `ENVX_NO_HINTS` is
set. The call is wrapped so a failure inside advisories can never affect CLI
exit behavior. No new dependencies. `envx run` intentionally does not show
advisories — it `process.exit()`s with the child's code, bypassing the
post-command hook, which is beneficial since it wraps another program's output.

**Files rewritten** (3):

- `README.md` (root, unversioned) — adds "Update notice & tips" subsection
  under Commands, Table of Contents entry
- `CLAUDE.md` (root, unversioned) — adds `printAdvisories` bullet to Code
  Style
- `docs/project/changes-log.md` (this entry)

**ADR triggered**: none — purely additive, opt-out via `ENVX_NO_HINTS`, no
new config-file contract.
**Downstream actions required**:

- [ ] None outstanding.

---

## 2026-07-13 — `envx skill`: bundled Agent Skills template + install/remove command

**Change type**: additive
**Triggered by**: `envx skill` feature implementation — spec
`docs/superpowers/specs/2026-07-13-envx-agent-skill-design.md`, plan
`docs/superpowers/plans/2026-07-13-envx-agent-skill.md`

**Code changes documented**: new bundled template `skills/envx/SKILL.md`
(Agent Skills–standard, shipped via `package.json` `files`); new
`src/commands/skill.ts` with `executeSkillAdd`/`executeSkillRemove` and
`createSkillCommand`, registered in `src/index.ts`; `skill add` installs to
`.agents/skills/envx/SKILL.md` (always) plus any of `.claude`/`.cursor`/`.codex`
detected at the project root (or explicit `--agent <names...>`), skipping
identical copies (reported as "already up to date") and locally-edited copies
with a warning unless `--force`; `skill remove` deletes all installed copies;
`envx init` now
prompts (default yes) to run the same install right after the `.gitignore`
step, warning but not failing `init` on error; `executeInit` is now exported
from `src/index.ts` for tests.

**Files rewritten** (4):

- `README.md` (root, unversioned) — adds Features bullet, `envx skill`
  command section, Table of Contents entry
- `CLAUDE.md` (root, unversioned) — adds `skill` command bullet to the
  Command Pattern list
- `docs/project/commands/commands.md` v1.1 → v1.2 — `skill` row in command
  inventory, new `envx skill` section
- `docs/project/changes-log.md` (this entry)

**ADR triggered**: none — fits existing bundled-asset distribution pattern
(`package.json` `files`); no new config-file contract.
**Downstream actions required**:

- [ ] `docs/project/commands/features/feature-project-commands.md`'s
      `envx init` step list (steps 7–8) is now stale — it doesn't mention
      the new skill-install prompt between the `.gitignore` step and the
      quick-start guide. Out of scope for this doc-sync task (restricted to
      README/CLAUDE/commands.md/changes-log.md); update in a follow-up.
- [ ] Per task brief: after this lands on `main`, verify the skills.sh
      channel from a scratch directory (`npx skills add rahulretnan/envx-cli`)
      discovers `skills/envx/SKILL.md`; adjust the template
      path/`resolveSkillTemplate`/`package.json` `files`/docs together if the
      expected layout differs.

---

## 2026-07-12 — Full-review fixes: cancellation, files-only projects, tmpdir isolation

**Change type**: additive
**Triggered by**: consolidated code review (CodeRabbit + repo pass + final
whole-branch review) — all findings fixed in commit `04a7df8`

**Code changes documented**: cancellation halts ride-along; `list`/`status`/
`--all` work in files-only projects; `--all` reuses stage passphrases
(`passphraseByVar`); idempotency temp + decrypt backup moved to `os.tmpdir()`;
warn on undecryptable existing `.gpg`; dry-run reports missing files as skips;
`config reset` preserves `files`/`environments`; single `# EnvX files` header;
parent-ignore-rule warning on `files add`; `rebaseToRoot` accepts `..`-prefixed
names; schema rejects `.GPG`/drive-relative; invalid `.envxrc` warns.

**Files rewritten** (12):

- `README.md` (root) — reset wording, test-coverage section refreshed
- `docs/project/commands/features/feature-files.md` v1.0 → v1.1
- `docs/project/commands/features/feature-encrypt.md` — ride-along documented
- `docs/project/commands/features/feature-decrypt.md` — ride-along documented
- `docs/project/commands/features/feature-config.md` — reset preservation
- `docs/project/commands/features/feature-create.md` — `-e` prompt wording
- `docs/project/commands/commands.md` — passphrase bullet incl. `FILES_SECRET`
- `docs/project/glossary.md` — `--all` definition includes registered files
- `docs/project/decisions.md` + `docs/project/adr/0002-envrc-envxrc-split.md` —
  `files` field in the `.envxrc` contract
- `docs/project/architecture-overview.md` — `files` command in diagram 1
- `docs/project/test-plan.md` — suite table matches actual test files
- `docs/project/README.md` — 9 feature specs

**ADR triggered**: none.
**Downstream actions required**:

- [ ] None outstanding.

---

## 2026-07-12 — `envx files`: registered secret-file encryption

**Change type**: additive
**Triggered by**: `envx files` feature implementation — spec
`docs/superpowers/specs/2026-07-12-envx-files-encryption-design.md`, plan
`docs/superpowers/plans/2026-07-12-envx-files-encryption.md`

**Files rewritten** (5):

- `README.md` (root, unversioned) — adds `envx files` command section, `.envxrc`
  `files` field row, `FILES_SECRET` note in Secret Variable Naming
- `CLAUDE.md` (root, unversioned) — adds `files` command bullet, `.envxrc` `files`
  field, exported-function notes for `executeEncrypt`/`executeDecrypt`
- `docs/project/commands/features/feature-files.md` (new) v1.0
- `docs/project/commands/commands.md` v1.0 → v1.1 — `files` row in command
  inventory, ride-along note in the `--all` matrix section
- `docs/project/changes-log.md` (this entry)

**ADR triggered**: none — fits existing `.envrc`/`.envxrc` split
([adr/0002](./adr/0002-envrc-envxrc-split.md)).
**Downstream actions required**:

- [ ] None outstanding.

---

## 2026-07-12 — Initial reverse-engineering from existing code

**Change type**: initial-reverse-engineer
**Triggered by**: `project-docs-sync` skill (Claude Code), "Right-sized CLI" scope

**Code-state snapshot** (envx-cli v1.4.2):

- Runtime: Node `>=14`, TypeScript strict; distributed as `envx-cli`, bin `envx`
- Source: 13 files — `index.ts`, 7 commands, `schemas`, `types`, 3 utils
- Crypto: system GPG, symmetric (`gpg -c`), passphrase via stdin
- Commands: encrypt, decrypt, create, copy, interactive, run, config +
  inline init/list(ls)/status/version
- Config files: `.envrc` (passphrases, git-ignored), `.envxrc` (JSON project
  config, committed); both discovered by upward walk to project root
- No server / DB / HTTP API / auth / webhooks / jobs / telemetry

**Docs generated** (20):

- `README.md`, `tech-stack.md`, `architecture-overview.md`, `glossary.md`,
  `decisions.md`, `changes-log.md`, `test-plan.md`
- `commands/commands.md`
- `commands/features/`: feature-encrypt, feature-decrypt, feature-create,
  feature-copy, feature-interactive, feature-run, feature-config,
  feature-project-commands
- `adr/`: 0001-gpg-symmetric-encryption, 0002-envrc-envxrc-split,
  0003-upward-config-discovery, 0004-run-in-memory-decrypt

**Deliberately skipped** (N/A for a CLI): `shared/` (rbac-matrix, nfr,
`webhooks-*`, async-architecture, observability, compliance-pii), `index/*`,
`api-*`, `schema-*`, `modules/` beyond the single Commands module.

**Not modified**: root `README.md` / `CLAUDE.md` / `CHANGELOG.md` / `TESTING.md`
— already accurate and current; left as the user-facing source of truth.

**ADR triggered**: 0001–0004 back-filled from implementation.
**Downstream actions required**:

- [ ] Keep these docs in sync on future code edits (change-tracking gate).

---

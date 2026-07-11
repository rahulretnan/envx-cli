# Changes Log

Source-of-truth for every doc change after initial generation. Append-only.
Newest at the top.

This is the **pointer log** — short summaries that reference the actual rewritten
files. The files themselves carry their own local changelog tables.

## Format

```markdown
## YYYY-MM-DDTHH:MM:SSZ — <one-line summary>

**Change type**: additive | breaking | rename | removal | architectural | typo | copy
**Triggered by**: <user request / discovery / audit>

**Files rewritten** (N):

- `<path>` v<X> → v<Y>

**ADR triggered**: <NNNN-slug.md> | none
**Downstream actions required**:

- [ ] <action>
```

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

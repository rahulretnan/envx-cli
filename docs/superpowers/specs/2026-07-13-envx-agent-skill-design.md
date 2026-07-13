# envx agent skill — SKILL.md for AI Coding Agents (Design)

**Date:** 2026-07-13
**Status:** Approved
**Feature:** Ship an Agent Skills–standard `SKILL.md` that teaches AI coding
agents (Claude Code, Cursor, Codex, and anything else that reads the format)
how to use envx in a project, installable via a new `envx skill` command and
offered during `envx init`.

## Motivation

AI agents working in an envx-managed repo routinely get the workflow wrong:
they read or print decrypted secrets, edit `.gpg` files, commit plaintext, or
don't know that `envx run` exists. The Agent Skills standard (SKILL.md with
YAML frontmatter, per-project skills folders, supported by 30+ agents and the
skills.sh ecosystem) gives us a single file that fixes this. envx should
install that file itself — no external registry required.

## Design decisions (agreed)

1. **Install target: universal + auto-detect.** Always write the canonical
   copy to `.agents/skills/envx/SKILL.md`; additionally copy into agent dirs
   detected at the project root (`.claude/`, `.cursor/`, `.codex/`). A
   `--agent` flag overrides detection. Copies, not symlinks (Windows-safe).
2. **Content: static template.** One generic SKILL.md that teaches the
   workflow and tells the agent to discover project state via `envx list`,
   `envx status`, `envx config show`. Never goes stale; no regeneration.
3. **Two channels, one source of truth, no separate repo.** The template
   lives at `skills/envx/SKILL.md` in this repo, ships in the npm package,
   and is what `npx skills add rahulretnan/envx-cli` (skills.sh) discovers.
4. **No `.envxrc` registry entry** for the skill — files on disk are the
   state (unlike `files`, there is nothing to ride along with).
5. **Skill files are committed** — no `.gitignore` changes.
6. **Skipped for v1:** `skill update`/`skill status` subcommands, per-agent
   content variants, project-aware generated content.

## 1. Template — `skills/envx/SKILL.md`

New top-level `skills/envx/SKILL.md` in the repo. Added to `package.json`
`files` so it ships in the published package. Resolved at runtime relative to
the package root (works from both `dist/` and ts-node).

Frontmatter:

```yaml
---
name: envx
description: >-
  Use when working in a project that manages secrets with envx — .env.<stage>
  files, .env.*.gpg encrypted files, .envrc passphrases, .envxrc config, or
  registered secret files. Covers encrypting/decrypting env files, running
  commands with injected secrets, and safety rules for handling plaintext.
---
```

Body sections (agent-facing instructions, imperative voice):

- **What envx is** — GPG encryption for `.env.<stage>` files and registered
  secret files; encrypted `.gpg` artifacts are committed, plaintext is not.
- **Key files** — `.envrc` (passphrases, git-ignored, NEVER commit or print),
  `.envxrc` (JSON project config, committed), `.env.<stage>` /
  `.env.<stage>.gpg`, registered files from the `files` array.
- **Discover state first** — run `envx list`, `envx status`,
  `envx config show`; do not assume environments or registered files.
- **Core workflows** — fresh clone: `envx decrypt --all`; after editing a
  plaintext env file: `envx encrypt -e <stage>`; run an app with secrets:
  `envx run -e <stage> -- <cmd>` (in-memory injection, no plaintext on
  disk); add a new secret file: `envx files add <path> [-e <stage>]`.
- **Safety rules** — never commit or print plaintext secrets; never edit
  `.gpg` files directly; never delete `.envrc`; re-encrypt after editing;
  passphrases come from `.envrc` or the user, never invent or hardcode them.
- **Command reference** — compact table of the full CLI surface
  (`init`, `encrypt`, `decrypt`, `create`, `copy`, `run`, `files`, `config`,
  `interactive`, `list`, `status`, `skill`).

## 2. Command — `envx skill` (`src/commands/skill.ts`)

Follows the existing pattern: `createSkillCommand()` returning a Commander
`Command` with subcommands, plus exported `executeSkillAdd()` /
`executeSkillRemove()`.

### `envx skill add [--agent <names...>] [--force] [-c, --cwd <path>]`

1. Resolve project root the same way other commands do (upward walk;
   fall back to cwd).
2. Read the bundled template from the package.
3. Write `.agents/skills/envx/SKILL.md` (always).
4. Detect agent dirs at the project root and copy into each:
   `.claude/` → `.claude/skills/envx/SKILL.md`, `.cursor/` →
   `.cursor/skills/envx/SKILL.md`, `.codex/` → `.codex/skills/envx/SKILL.md`.
5. `--agent claude cursor codex agents` overrides detection (installs into
   the named targets whether or not the dir exists).
6. Idempotency per target: identical content → skip silently (report
   "up to date"); existing but different (user edited) → warn and skip
   unless `--force`.
7. Summary output listing each target and its outcome.

### `envx skill remove [-c, --cwd <path>]`

Deletes `skills/envx/` under each known location (`.agents`, `.claude`,
`.cursor`, `.codex`) if present; reports what was removed.

### Validation

Minimal Zod schema in `src/schemas/index.ts` (`skillOptionsSchema`): optional
`agent` array constrained to the known agent names, optional booleans/cwd.
Types in `src/types/index.ts` (`SkillOptions`).

## 3. Init integration

In `executeInit` (`src/index.ts`), immediately after the `.gitignore` step:

```ts
const installSkill = await InteractiveUtils.confirmOperation(
  'Install the envx agent skill for AI coding agents (Claude Code, Cursor, Codex)?',
  true
);
if (installSkill) {
  await executeSkillAdd({ cwd: options.cwd });
}
```

Failure to install the skill warns but does not fail init (same tolerance as
the gitignore step).

## 4. skills.sh channel

No code. The repo layout (`skills/envx/SKILL.md`) is the convention the
skills.sh CLI scans for. Verify during implementation with a dry run of
`npx skills add rahulretnan/envx-cli` after the file lands on `main`; adjust the
path if the CLI expects a different layout, keeping a single source of truth.

## 5. Testing

Core (`__tests__/core/skill.test.ts`):

- Template file exists, has parseable frontmatter with `name` and
  `description`.
- `executeSkillAdd` in a temp dir writes the canonical `.agents` copy.
- Detection: pre-create `.claude/` → copy lands in `.claude/skills/envx/`.
- `--agent` override installs to named targets only (plus canonical).
- Re-run with identical content → skip, no error.
- Target edited locally → skipped without `--force`, overwritten with it.
- `executeSkillRemove` deletes installed copies.

Integration (`__tests__/integration/cli.test.ts`): `dist/index.js skill add`
in a temp project creates `.agents/skills/envx/SKILL.md`. (Requires
`npm run build` first, as usual.)

## 6. Documentation updates

- **README.md** — new "AI agent skill" section: what it does, both install
  commands (`envx skill add`, `npx skills add rahulretnan/envx-cli`), note that
  init offers it.
- **CLAUDE.md** — add `skill` to the command list in Command Pattern section.
- **docs/project/** — sync whichever command-reference docs list the CLI
  surface (audit during implementation; this went stale before with `files`).

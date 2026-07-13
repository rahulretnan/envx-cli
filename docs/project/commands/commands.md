---
Module: Commands
Owners: Rahul Retnan
Status: Implemented
Version: 1.2
Last Updated: 2026-07-13
---

# Module: Commands

## Purpose

EnvX is a single CLI surface. This "module" is the whole tool: the command
inventory, the behavior every command shares (cwd resolution, discovery,
passphrase resolution, output), and the two different meanings of `--all`.

Each command lives in `src/commands/<name>.ts` (except the inline ones, which live
in `src/index.ts`) and exports `createXxxCommand()` + `executeXxx()`.

## Command inventory

| Command                               | File                      | One-liner                                                  | Feature spec                                                       |
| ------------------------------------- | ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `encrypt`                             | `commands/encrypt.ts`     | GPG-encrypt `.env.<stage>` → `.gpg`                        | [feature-encrypt](./features/feature-encrypt.md)                   |
| `decrypt`                             | `commands/decrypt.ts`     | GPG-decrypt `.gpg` → `.env.<stage>`                        | [feature-decrypt](./features/feature-decrypt.md)                   |
| `create`                              | `commands/create.ts`      | Create new `.env.<stage>` files (optionally from template) | [feature-create](./features/feature-create.md)                     |
| `copy`                                | `commands/copy.ts`        | Copy a stage file to plain `.env` (auto-decrypts)          | [feature-copy](./features/feature-copy.md)                         |
| `interactive`                         | `commands/interactive.ts` | Set up `.envrc` secrets via prompts                        | [feature-interactive](./features/feature-interactive.md)           |
| `run`                                 | `commands/run.ts`         | Decrypt in memory, run a sub-process with vars injected    | [feature-run](./features/feature-run.md)                           |
| `config`                              | `commands/config.ts`      | Manage `.envxrc` (show / ignore / exclude / reset)         | [feature-config](./features/feature-config.md)                     |
| `files`                               | `commands/files.ts`       | Register + GPG-encrypt/decrypt arbitrary secret files      | [feature-files](./features/feature-files.md)                       |
| `skill`                               | `commands/skill.ts`       | Install/remove the bundled AI-agent `SKILL.md`             | — (see [`envx skill`](#envx-skill) below)                          |
| `init` `list`/`ls` `status` `version` | `index.ts` (inline)       | First-run setup, listing, status, version info             | [feature-project-commands](./features/feature-project-commands.md) |

## Command dispatch

```mermaid
flowchart LR
  argv --> commander[commander parseAsync]
  commander --> hook[preAction: --quiet mutes non-error output]
  hook --> action[command action]
  action --> exec[executeXxx rawOptions]
  exec --> zod[validateXxxOptions]
  zod --> work[work] --> exit[process.exit ExitCode]
```

## Shared behavior

- **Global flags:** `-v, --verbose`, `-q, --quiet` (registered on the program).
  `--quiet` overrides `console.log` to drop everything except messages containing
  `✗`.
- **Working directory:** `--cwd <path>` else `ExecUtils.getCurrentDir()`
  (`shell.pwd()`). Every command accepts `-c, --cwd`.
- **Discovery:** `FileUtils.findAllEnvironments(cwd)` globs `**/.env.*`, skips
  `excludeDirs`, filters `ignore` names. `findEnvFiles(stage, cwd)` returns plain +
  `.gpg` variants, each flagged `encrypted`.
- **Passphrase resolution** (encrypt/decrypt/copy/run/files): `--passphrase` → `-s
<secret>` from `.envrc` → `<STAGE>_SECRET` from `.envrc` → interactive prompt.
  Global registered files use `FILES_SECRET` in place of `<STAGE>_SECRET`.
  `.envrc` is read via `readEnvrcNearest` (upward walk).
- **GPG guard:** commands that touch crypto check `isGpgAvailable()` and, for
  encrypt/decrypt, run `testGpgOperation` (a temp-file round-trip) before real work.
- **Output:** all through `CliUtils` (chalk) — `success ✓`, `error ✗`, `warning ⚠`,
  `info ℹ`, headers, tables.
- **Exit codes:** `ExitCode` enum — `SUCCESS 0`, `GENERAL_ERROR 1`,
  `INVALID_ARGS 2`, `FILE_ERROR 3`, `GPG_ERROR 4`, `USER_CANCELLED 5`.

## The `--all` matrix (important)

`--all` means different things per command, and Zod validation enforces it:

| Command               | `--all` means                             | `-e/--environment` with `--all`    |
| --------------------- | ----------------------------------------- | ---------------------------------- |
| `encrypt` / `decrypt` | all discovered **environments**           | **forbidden** (mutually exclusive) |
| `copy`                | all **directories** containing that stage | **required**                       |
| `run`                 | (no `--all`)                              | —                                  |

`validateEncryptOptions` / `validateDecryptOptions` swap to a permissive schema
when `--all` is set; `validateCopyOptions` throws if `--all` is set without `-e`.

**Registered files ride along `encrypt`/`decrypt`:** `-e <stage>` also processes any
`files` registry entries bound to that stage (reusing the resolved passphrase; a
declined confirm cancels ride-along too); `--all` also processes **every**
registered entry, stage-bound and global alike (stage passphrases reused via
`passphraseByVar`, globals resolve against `FILES_SECRET`) — and works in
files-only projects with no `.env.*`. See
[feature-files](./features/feature-files.md).

## `envx skill`

Installs the bundled Agent Skills–standard `SKILL.md` (`skills/envx/SKILL.md`
at the repo root, shipped via `package.json` `files`) so AI coding agents can
read envx's workflow rules directly from the project. No passphrase or GPG
involvement — this command only copies a static template file.

- **Subcommands:** `skill add`, `skill remove`.
- **`skill add` flags:**
  - `-a, --agent <names...>` — install into specific agent dirs only
    (`agents`, `claude`, `cursor`, `codex`) instead of auto-detecting.
  - `-f, --force` — overwrite a locally edited copy that differs from the
    template (normally skipped with a warning).
  - `-c, --cwd <path>` — working directory used to resolve the project root.
- **`skill remove` flags:** `-c, --cwd <path>` only.
- **Install locations:** `.agents/skills/envx/SKILL.md` is always written
  (the universal Agent Skills location). Without `--agent`, `skill add` also
  auto-detects `.claude/`, `.cursor/`, `.codex/` directories at the project
  root and installs matching copies at `.claude/skills/envx/SKILL.md`,
  `.cursor/skills/envx/SKILL.md`, `.codex/skills/envx/SKILL.md`.
- **Idempotency:** a target whose existing content is byte-identical to the
  template is skipped and reported as "already up to date" (info-level); a
  target that differs (locally edited) is skipped with a warning unless
  `--force` is passed.
  `skill remove` deletes each installed `skills/envx/` directory outright and
  reports if none were found.
- **Init integration:** `envx init` prompts to run the same install (default
  yes) right after the `.gitignore` step; a failure during `init` only warns
  — it never fails the init flow.

## Cross-cutting

- **Config resolution order:** passphrase → flag > `.envrc` > prompt; cwd → flag >
  `process.cwd()`; ignore/exclude → explicit arg > `.envxrc` > `FileUtils` defaults.
- **Monorepo:** `.envrc`/`.envxrc` resolved by upward walk; stage files are
  cwd-local. See [architecture-overview.md](../architecture-overview.md) §6.

## Test plan summary

See [test-plan.md](../test-plan.md).

## Open questions

- [ ] None outstanding at reverse-engineering time.

## Changelog

| Version | Date       | Changes                                                            |
| ------- | ---------- | ------------------------------------------------------------------ |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft                                   |
| 1.1     | 2026-07-12 | Add `files` command row + `--all` ride-along note for `envx files` |
| 1.2     | 2026-07-13 | Add `skill` command row + `envx skill` section                     |

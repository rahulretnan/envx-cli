# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EnvX (`envx-cli` on npm) is a CLI tool for secure environment file encryption and management using GPG. It manages `.env.<stage>` files across environments (local, development, staging, production) with passphrases stored in `.envrc` (direnv convention) and project-level config in `.envxrc` (JSON).

## Commands

```bash
# Build
npm run build          # TypeScript compilation to dist/

# Development
npm run dev            # Run via ts-node (src/index.ts)

# Test
npm test               # Run all tests (Jest, ts-jest)
npm run test:core      # Core unit tests only (__tests__/core/)
npm run test:integration  # Integration tests only — REQUIRES `npm run build` first
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report

# Run a single test file
npx jest __tests__/core/file.test.ts
# Run a single test by name
npx jest -t "should encrypt environment file"

# Lint & Format
npm run lint           # ESLint check (src + __tests__)
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run format:check   # Prettier check

# Release (uses release-it with conventional changelog)
npm run release:patch  # Patch version bump
npm run release:minor  # Minor version bump
npm run release:dry    # Dry run
```

Integration tests in `__tests__/integration/cli.test.ts` shell out to the compiled `dist/index.js`, so always run `npm run build` before `test:integration` (or full `npm test`) when source has changed.

## Architecture

### Entry Point & CLI Framework

`src/index.ts` — Creates the Commander.js program, registers subcommands, and defines the inline `list` (alias `ls`), `status`, `init`, and `version` commands. Exported `createProgram()` allows module usage. The `init` command orchestrates the full first-run flow: detect environments, discover and offer to ignore non-secret ones, write `.envxrc`, update `.gitignore`, run interactive secret setup, and optionally encrypt selected environments.

### Command Pattern

Each command file in `src/commands/` exports a `createXxxCommand()` function returning a Commander `Command`, plus an `executeXxx()` async function with the core logic. Commands available:

- **`encrypt`** / **`decrypt`** — GPG operations on `.env.<stage>` files. Support `--all` (batch all environments), `--overwrite`, `--dry-run`.
- **`create`** — Create new `.env.<stage>` files (optionally from a template).
- **`copy`** — Copy a stage file to plain `.env`. Note: `--all` here means _all directories_ containing that environment, so `-e/--environment` is **required** when `--all` is used (different semantics from encrypt/decrypt).
- **`interactive`** — Inquirer-driven setup for secrets in `.envrc`.
- **`run`** — Decrypt an env file in memory and spawn a sub-process with variables injected via `process.env`. Supports `-e <stage>`, repeatable `-f/--env-file`, repeatable `--env KEY=VAL`, `--overload`, and `--dry-run`. dotenvx-style precedence: `process.env` wins over files by default. Never writes plaintext to disk. See `docs/superpowers/specs/2026-04-07-envx-run-design.md` for the full design.
- **`config`** — Manage `.envxrc`. Subcommands: `show`, `ignore list/add/remove`, `exclude list/add/remove`, `reset`.
- **`files`** — Manage and encrypt/decrypt arbitrary registered secret files (service account JSON, certs, keystores — anything that isn't a `.env.<stage>` file). Subcommands: `add <path> [-e <stage>] [--no-gitignore]`, `remove <path>`, `list`, `encrypt [path] [--dry-run] [-p] [-s]`, `decrypt [path] [--overwrite] [--dry-run] [-p] [-s]`. Registrations live in `.envxrc`'s `files` array. Stage-bound entries ride along `encrypt -e <stage>` / `decrypt -e <stage>` (and `--all`), reusing that stage's resolved passphrase; global (no-stage) entries use a dedicated `FILES_SECRET` variable in `.envrc`.

`encrypt.ts` and `decrypt.ts` import `processRegisteredFiles` from `files.ts` to encrypt/decrypt stage-bound and global registered files as a ride-along step. `executeEncrypt`/`executeDecrypt` are now exported (previously only `createXxxCommand` was) so the ride-along tests can call them directly. Each command's internal `processSingleEnvironment` now returns `{ successCount, errorCount, passphrase }` so the already-resolved stage passphrase can be reused for stage-bound registered files without re-prompting.

### Utility Classes (Static Methods)

All utilities in `src/utils/` use static class methods, not instances:

- **`ExecUtils`** (`utils/exec.ts`) — GPG operations (`encryptFile`, `decryptFile`, `testGpgOperation`), shell execution, GPG availability check, `getCurrentDir()`.
- **`CliUtils`** (`utils/exec.ts`) — Formatted terminal output via chalk (`success`, `error`, `warning`, `info`, `header`, `subheader`, `printTable`, `formatEnvironment`, `formatPath`).
- **`FileUtils`** (`utils/file.ts`) — File discovery via `fast-glob`, `.envrc` parsing/writing, `.envxrc` parsing/writing/merging, `.gitignore` management, ignore-pattern and exclude-dir resolution, hashing, backup helpers, path manipulation. Holds `DEFAULT_IGNORE_PATTERNS` (`example`, `sample`, `template`) and `DEFAULT_EXCLUDE_DIRS` (`node_modules`, `.git`, `dist`, `.next`, `.turbo`, `.output`, `.nuxt`, `.cache`, `build`, `coverage`, `.svelte-kit`).
- **`InteractiveUtils`** (`utils/interactive.ts`) — User prompts via `inquirer` (confirmations, passphrase input, environment selection — single and multi).

### Configuration Files

Two distinct config files live alongside each project:

- **`.envrc`** — direnv-style shell file (`export KEY="val"`). Holds the GPG passphrase(s). Git-ignored. **Discovered by walking upward from `cwd` via `FileUtils.readEnvrcNearest`** — commands run from a monorepo subdirectory find the `.envrc` at the repo root.
- **`.envxrc`** — JSON project config. **Committable and meant to be shared.** Discovered by walking upward via `FileUtils.findEnvxrcUpward`. Optional fields:
  - `ignore: string[]` — environment names to skip during discovery (case-insensitive exact match). When unset, falls back to `FileUtils.DEFAULT_IGNORE_PATTERNS`. An empty array `[]` is the explicit "no filtering" escape hatch.
  - `excludeDirs: string[]` — directory names excluded from `fast-glob` walks. When unset, falls back to `FileUtils.DEFAULT_EXCLUDE_DIRS`.
  - `environments: string[]` — environments the user opted into managing during `envx init`.
  - `files: Array<{ path: string; stage?: string }>` — registered secret files, managed via `envx files add/remove/list`. `path` is root-relative (rejects absolute paths, `..`, and `.gpg`). Entries with `stage` ride along that stage's `encrypt`/`decrypt`; entries without `stage` use `FILES_SECRET`.

  Read/write through `FileUtils.readEnvxrc`, `writeEnvxrc`, and `mergeEnvxrc`. Validated by `envxrcFileConfigSchema` in `src/schemas/index.ts` (named to avoid collision with the older `envrcConfigSchema`).

  The upward walk stops at the first ancestor containing any of `.envrc`, `.envxrc`, or `.git` — that ancestor is treated as the project root. If the project root doesn't contain the specific file being looked up, the walk returns `null` and callers fall back to their existing no-config behavior (e.g., passphrase prompt). Writes via `FileUtils.mergeEnvxrc` target the nearest existing `.envxrc`, so `envx config ignore add` from a subdirectory edits the root config.

### Environment Discovery

`FileUtils.findAllEnvironments(cwd, ignorePatterns?)` globs `**/.env.*` with the resolved `excludeDirs` ignored, then filters out ignored environment names. Pass `undefined` to use config/defaults; pass `[]` to disable filtering entirely (used by `init` to detect what's being auto-ignored).

`FileUtils.findEnvFiles(env, cwd)` returns both plain and `.gpg`-encrypted files for a given environment, marking each with an `encrypted` flag.

### Validation

`src/schemas/index.ts` — Zod schemas validate all command inputs. The `--all` flag dynamically alters schema requirements:

- `encrypt`/`decrypt`: `--all` makes `environment` forbidden (mutually exclusive).
- `copy`: `--all` makes `environment` **required** (it iterates over directories, not environments).

`validateEncryptOptions` / `validateDecryptOptions` swap to a permissive schema when `--all` is set.

### Types

`src/types/index.ts` — Core interfaces: `CliOptions`, `EncryptOptions`, `DecryptOptions`, `CreateOptions`, `InteractiveOptions`, `EnvFile`, `StageSecret`, `EnvrcConfig` (`Record<string, string>`), `RegisteredFile` (`{ path: string; stage?: string }`), `EnvxrcConfig` (`{ ignore?, environments?, excludeDirs?, files?: RegisteredFile[] }`), `CommandResult`, `FileOperationResult`, and `ExitCode` enum.

### Configuration Resolution Order

- **Passphrase**: `--passphrase` flag > `.envrc` file > interactive prompt.
- **Working directory**: `--cwd` flag > `process.cwd()`.
- **Ignore patterns / exclude dirs**: explicit argument > `.envxrc` > defaults on `FileUtils`.

## Code Style

- TypeScript strict mode with all strict checks enabled.
- Path alias `@/*` maps to `src/*` (tsconfig).
- Single quotes, semicolons, trailing commas (es5), 2-space indent, 80-char line width.
- `console.log` is allowed (CLI tool) — ESLint `no-console` is off.
- Pre-commit hooks run ESLint + Prettier via husky/lint-staged.
- Pre-existing `@typescript-eslint/no-explicit-any` warnings throughout `commands/` (raw Commander option objects) — leave them alone unless changing the surrounding logic.

## Testing Approach

Tests use Jest with ts-jest. Core tests validate schemas, file utilities, `.envxrc` handling, the `--all` flag matrix, and command workflows using mocks and temp directories (`fs.mkdtemp` cleaned in `afterEach`). Integration tests exec the actual built CLI via `execSync` against `dist/index.js`, so the build must be current. Tests focus on user-facing behavior — UI/cosmetic output (chalk colors, inquirer styling) is intentionally not tested.

When adding patterns to `FileUtils.updateGitignore` (the `envPatterns` / `secretPatterns` arrays), update the corresponding pattern-count assertions in `__tests__/core/file.test.ts`.

Commander.js converts dashed flags to camelCase in `rawOptions` (e.g. `--dry-run` → `rawOptions.dryRun`, `--all-dirs` → `rawOptions.allDirs`). Read flags off the raw options object accordingly.

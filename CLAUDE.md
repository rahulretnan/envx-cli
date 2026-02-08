# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EnvX (`envx-cli` on npm) is a CLI tool for secure environment file encryption and management using GPG. It manages `.env.<stage>` files across environments (local, development, staging, production) with secrets stored in `.envrc` (direnv convention).

## Commands

```bash
# Build
npm run build          # TypeScript compilation to dist/

# Development
npm run dev            # Run via ts-node

# Test
npm test               # Run all tests (120 tests, ~11s)
npm run test:core      # Core unit tests only (__tests__/core/)
npm run test:integration  # Integration tests only (__tests__/integration/)
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report

# Lint & Format
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run format:check   # Prettier check

# Release (uses release-it with conventional changelog)
npm run release:patch  # Patch version bump
npm run release:minor  # Minor version bump
npm run release:dry    # Dry run
```

## Architecture

### Entry Point & CLI Framework

`src/index.ts` — Creates the Commander.js program, registers commands, and defines inline commands (`list`, `status`, `init`, `version`). Exported `createProgram()` allows module usage.

### Command Pattern

Each command file in `src/commands/` exports a `createXxxCommand()` function returning a Commander `Command`, and an `executeXxx()` async function with the core logic. Commands support `--all` for batch processing across all environments and `--overwrite` for non-interactive operation.

### Utility Classes (Static Methods)

All utilities in `src/utils/` use static class methods, not instances:

- **`ExecUtils`** (`utils/exec.ts`) — GPG operations (`encryptFile`, `decryptFile`, `testGpgOperation`), shell execution, GPG availability check
- **`CliUtils`** (`utils/exec.ts`) — Formatted terminal output via chalk (`success`, `error`, `warning`, `info`, `printTable`)
- **`FileUtils`** (`utils/file.ts`) — File discovery via `fast-glob`, `.envrc` parsing/writing, `.gitignore` management, path manipulation
- **`InteractiveUtils`** (`utils/interactive.ts`) — User prompts via `inquirer`, confirmations, passphrase input

### Validation

`src/schemas/index.ts` — Zod schemas validate all command inputs. The `--all` flag dynamically alters schema requirements (environment becomes optional when processing all).

### Types

`src/types/index.ts` — Core interfaces: `CliOptions`, `EncryptOptions`, `DecryptOptions`, `CreateOptions`, `EnvFile`, `StageSecret`, `EnvrcConfig`, `CommandResult`, `FileOperationResult`.

### Configuration Resolution Order

Passphrase: `--passphrase` flag > `.envrc` file > interactive prompt. Working directory: `--cwd` flag > `process.cwd()`.

## Code Style

- TypeScript strict mode with all strict checks enabled
- Path alias `@/*` maps to `src/*` (tsconfig)
- Single quotes, semicolons, trailing commas (es5), 2-space indent, 80-char line width
- `console.log` is allowed (CLI tool) — ESLint `no-console` is off
- Pre-commit hooks run ESLint + Prettier via husky/lint-staged

## Testing Approach

Tests use Jest with ts-jest. Core tests validate schemas, file utilities, and command workflows using mocks. Integration tests execute the actual CLI binary. Tests focus on user-facing behavior — UI/cosmetic output (chalk colors, inquirer styling) is not tested.

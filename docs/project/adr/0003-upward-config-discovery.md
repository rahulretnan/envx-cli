---
Status: Accepted
Date: 2026-07-12 (back-filled)
---

# ADR 0003 — Discover `.envrc`/`.envxrc` by walking upward to the project root

## Context

In a monorepo, commands are often run from a package subdirectory
(`packages/db/`) but the passphrases (`.envrc`) and project config (`.envxrc`)
live at the repo root. Requiring a copy in every package is duplication and drift.

## Decision

Resolve `.envrc` and `.envxrc` by **walking upward** from `cwd`:

1. `findProjectRoot(cwd)` walks up until it hits the first ancestor containing any
   of `.envrc`, `.envxrc`, or `.git` — that ancestor is the **project root**.
2. `findEnvrcUpward` / `findEnvxrcUpward` return that root only if it actually
   contains the specific file; otherwise `null`.
3. Callers fall back to their no-config path on `null` (prompt for passphrase; use
   default ignore/exclude patterns).

**Stage files (`.env.<stage>[.gpg]`) are NOT discovered upward** — they resolve
from `cwd` only (`resolveStageFile`, `findEnvFiles`). Only shared config walks up.

Writes via `mergeEnvxrc` target the nearest existing `.envxrc`, so
`envx config ignore add` from a subdirectory edits the root config, not a
package-local shadow.

## Consequences

**Positive**

- `envx run -e dev -- pnpm migrate` from `packages/db/` uses the root `.envrc`
  automatically. No per-package config.
- The `.git`/`.envrc`/`.envxrc` marker set makes "project root" well-defined and
  stops the walk from escaping the repo.

**Negative / trade-offs**

- Slightly more filesystem stat calls per command (bounded by directory depth).
- Not symlink-aware: the path is resolved once via `path.resolve` and walked
  as-given (no per-step `realpath`). Acceptable for normal repo layouts.

## Alternatives considered

- **cwd-only** (original behavior) — simplest, but breaks monorepo subdirectory
  usage.
- **Walk upward for stage files too** — rejected: a stage file is inherently
  local to where you run; walking up could pick up an unrelated ancestor's env.

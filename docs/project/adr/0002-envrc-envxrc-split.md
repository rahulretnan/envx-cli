---
Status: Accepted
Date: 2026-07-12 (back-filled)
---

# ADR 0002 — Two config files: `.envrc` (secret) vs `.envxrc` (shared)

## Context

EnvX has two very different kinds of configuration: **secret passphrases** (must
never be committed) and **project settings** — which environments are managed,
which names to ignore, which directories to skip during discovery (safe and
useful to share across the team).

## Decision

Split them into two files with opposite git policies:

| File      | Format                        | Holds                                   | Git           |
| --------- | ----------------------------- | --------------------------------------- | ------------- |
| `.envrc`  | direnv shell (`export K="v"`) | GPG passphrases (`<STAGE>_SECRET`)      | **ignored**   |
| `.envxrc` | JSON                          | `ignore`, `excludeDirs`, `environments` | **committed** |

`.envrc` follows the direnv convention so the same file can auto-load secrets into
the shell via `direnv allow`. `.envxrc` is a plain JSON config managed by
`envx init` and `envx config`.

## Consequences

**Positive**

- Clear security boundary: the git-ignored file is the _only_ secret file. The
  committed file carries only non-sensitive project settings.
- `.gitignore` is set up by `envx init` to ignore `.envrc` and `.env.*` while
  allowing `*.gpg` and `.env.example`.
- Teammates cloning the repo inherit ignore/exclude/enrolled-environment settings
  automatically via the committed `.envxrc`.

**Negative / trade-offs**

- Two files to reason about. Mitigated by `envx config` (no manual JSON editing)
  and by documenting the split prominently.
- Historically `.envxrc` was git-ignored; it is now committed by default. Docs and
  `.gitignore` defaults were aligned accordingly.

## Notes

Validated by `envxrcFileConfigSchema` (named to avoid colliding with the older
`envrcConfigSchema`, which types `.envrc` as `Record<string,string>`).

---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Feature: Project commands (`init`, `list`/`ls`, `status`, `version`)

## Summary

The four commands defined inline in `src/index.ts` (not in `src/commands/`).
`init` is the first-run wizard; the rest are read-only inspection plus version
info. All accept `-c, --cwd <path>` except `version`.

---

## `envx init`

First-run setup. Orchestrates the full onboarding flow.

**Steps (`executeInit`):**

1. Show welcome; verify GPG (`isGpgAvailable`) — if missing, print prerequisites
   and return.
2. Discover environments two ways: ignore-filtered (managed candidates) and
   unfiltered (to detect what's being auto-ignored, e.g. `example`/`sample`).
3. If EnvX already looks set up (envs found or `.envrc` exists), confirm before
   continuing.
4. Report auto-ignored non-secret environments.
5. Multi-select which environments to manage (pre-checked). Offer to add the
   non-selected ones to `.envxrc.ignore`.
6. Save selected environments to `.envxrc` (`mergeEnvxrc`).
7. `updateGitignore(cwd)` — add EnvX patterns (`.env.*`, `!.env.example`,
   `!.env.*.gpg`, `.envrc`).
8. Show quick-start guide.
9. Offer interactive secret setup (`executeInteractive`); if done and
   environments were selected, offer to encrypt them now (`encryptEnvironment`).

**Edge cases:** GPG missing → prerequisites + return. Already set up → confirm.
Nothing selected → skip the manage/ignore steps.

---

## `envx list` (alias `ls`)

List every environment file and its status. Ignore-filtered.

- `findAllEnvironments(cwd)` → for each, `findEnvFiles` → table of
  **Environment · File Path · Type (`.env`/`.gpg`) · Status (Encrypted/Unencrypted)**.
- Prints whether `.envrc` is present.
- Empty project → suggest `envx init` / `envx create -i`.

---

## `envx status`

Project encryption posture + recommendations. Ignore-filtered.

- Prerequisites: GPG availability (prints install help if missing and returns).
- Summary: total environments, total files, encrypted vs unencrypted counts.
- `.envrc` presence.
- **Recommendations:** flags unencrypted `production`/`staging` files; suggests
  `.envrc` setup if missing. If none → "follows security best practices 🎉".

---

## `envx version`

Prints EnvX version, description, GPG availability, and Node version. (Commander
also provides `--version` from `package.json`.)

---

## Exit codes

Inspection commands exit `SUCCESS 0`; their action wrappers catch errors and exit
`GENERAL_ERROR 1`. `init` returns early (not an error exit) when GPG is missing or
the user cancels.

## Related

- [feature-interactive](./feature-interactive.md) · [feature-config](./feature-config.md)
  · [feature-encrypt](./feature-encrypt.md) · [commands.md](../commands.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |

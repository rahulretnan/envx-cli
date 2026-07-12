---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Feature: `envx copy`

## Summary

Copy a stage file to plain `.env` — the file an app actually loads. If the source
is encrypted, it decrypts during the copy. Built for deployment / environment
switching. Source: `src/commands/copy.ts`.

## Usage

```bash
envx copy -e production                     # single dir: .env.production → .env
envx copy -e production --all               # every dir with that stage's files
envx copy -e staging --overwrite
envx copy -e production -p "pass"           # decrypt during copy
envx copy -e production -s PRODUCTION_SECRET
```

## Flags

| Flag                      | Meaning                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `-e, --environment <env>` | Stage to activate. **Required** (also with `--all`).       |
| `-a, --all`               | Process **all directories** containing that stage's files. |
| `-p, --passphrase <pass>` | Passphrase (only if source is encrypted).                  |
| `-s, --secret <secret>`   | Secret var name in `.envrc`.                               |
| `--overwrite`             | Overwrite existing `.env` without confirmation.            |
| `-c, --cwd <path>`        | Working directory.                                         |

> **`--all` here differs from encrypt/decrypt.** It iterates over _directories_,
> not environments, so `-e` is required. `validateCopyOptions` throws otherwise.

## Behavior

1. If `--all` without `-e` → throw.
2. Discover environments (validation). None → warn + return.
3. **Single-dir mode:** find the stage's files in the current directory. If none
   there but some exist elsewhere, show those directories and offer to process all
   of them instead.
4. **Source selection:** prefer the **unencrypted** file; fall back to the
   encrypted `.gpg`.
5. **Unencrypted source:** `copyFile` → `<dir>/.env`.
6. **Encrypted source:**
   - `isGpgAvailable()` guard.
   - Resolve passphrase (`-p` → `-s` → `<STAGE>_SECRET` → prompt; `.envrc` via
     upward walk so it works from monorepo subdirs).
   - `testGpgOperation`.
   - Back up any existing `.env`, `decryptFile` → `.env`; on failure restore the
     backup, on success remove it.
7. Multi-dir mode groups files by directory and runs step 4–6 per directory,
   independently, with an overall summary.

## Edge cases (from code)

| Scenario                                     | Behavior                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Stage files only in other dirs (single mode) | Offer to process all those dirs.                                       |
| Existing `.env`, no `--overwrite` (single)   | Show its size, confirm overwrite.                                      |
| Encrypted source, decrypt fails              | Restore `.env` from backup, error out.                                 |
| GPG missing, encrypted source                | Single: `GPG_ERROR (4)`; `--all`: throw for that dir, continue others. |
| `production`/`prod` stage                    | Print a security warning about using prod vars locally.                |
| Any dir fails (`--all`)                      | Continue rest; exit `GENERAL_ERROR (1)` if any failed.                 |

## Exit codes

`SUCCESS 0` · `GENERAL_ERROR 1` · `GPG_ERROR 4`.

## Related

- [feature-decrypt](./feature-decrypt.md) · [feature-run](./feature-run.md) ·
  [commands.md](../commands.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |

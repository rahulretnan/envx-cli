---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Feature: `envx encrypt`

## Summary

Encrypt unencrypted `.env.<stage>` files into `.env.<stage>.gpg` using symmetric
GPG. Registered secret files **ride along**: `-e <stage>` also encrypts files
bound to that stage (reusing the stage passphrase), and `--all` also encrypts
every registered file — stage-bound with their stage secret, globals with
`FILES_SECRET`. See [feature-files](./feature-files.md).
Source: `src/commands/encrypt.ts`.

## Usage

```bash
envx encrypt -e production                 # one stage
envx encrypt --all                         # every discovered stage
envx encrypt -e production --dry-run       # preview, no changes
envx encrypt -e prod -s CUSTOM_SECRET      # custom .envrc secret
envx encrypt -e staging -i                 # interactive file selection
envx encrypt -e production --overwrite     # skip confirmation
```

## Flags

| Flag                      | Meaning                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| `-e, --environment <env>` | Stage to encrypt. Required unless `--all`.                          |
| `-a, --all`               | All discovered environments. Mutually exclusive with `-e` and `-i`. |
| `-p, --passphrase <pass>` | Encryption passphrase.                                              |
| `-s, --secret <secret>`   | Name of a secret var in `.envrc` to use as passphrase.              |
| `-i, --interactive`       | Pick which files to encrypt (single stage, >1 file).                |
| `--overwrite`             | Skip the confirm prompt.                                            |
| `--dry-run`               | Show what would be encrypted; make no changes.                      |
| `-c, --cwd <path>`        | Working directory.                                                  |

## Behavior

1. If `--all`: reject `-e` and `-i` (throws before work).
2. `isGpgAvailable()` guard → exit `GPG_ERROR (4)` with install help if missing.
3. `findAllEnvironments(cwd)` (ignore-filtered). If none → warn + return —
   unless `--all` and registered files exist (files-only project), in which
   case the registered files are still processed.
4. Single stage without `-e`: auto-pick if exactly one exists, else prompt.
   Validate the stage is in the discovered set.
5. Resolve passphrase: `-p` → `-s` secret in `.envrc` → `<STAGE>_SECRET` in
   `.envrc` → prompt. (`.envrc` via `readEnvrcNearest`, upward walk.)
6. `testGpgOperation(passphrase)` round-trips a temp file to verify the passphrase
   works before touching real files.
7. `findEnvFiles` → keep unencrypted, existing files.
8. **Idempotency check:** if a `.gpg` already exists, decrypt it to a temp file and
   compare hashes. Identical → "already encrypted, skipping" (counts as success).
   Different → re-encrypt. Temp file always cleaned up.
9. `encryptFile` (passphrase via stdin) → writes `.gpg`.
10. **Ride-along:** after env files, registered files run through
    `processRegisteredFiles` — for `-e <stage>` only that stage's entries
    (reusing the resolved passphrase); for `--all` every entry, with each
    stage's already-resolved passphrase reused (`passphraseByVar`) and globals
    using `FILES_SECRET`. A **declined confirm cancels the whole stage** —
    ride-along is skipped too.

## Passphrase resolution

`--passphrase` > `-s <secret>` (`.envrc`) > `<STAGE>_SECRET` (`.envrc`) > prompt.

## Edge cases (from code)

| Scenario                                             | Behavior                                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| No environments found                                | Warn, suggest `create`, return `SUCCESS`.                                                                                                    |
| Stage not in discovered set                          | Throw `Environment '<x>' not found. Available: …`.                                                                                           |
| `.gpg` exists, same content                          | Skip, count success.                                                                                                                         |
| `.gpg` exists, changed content                       | Re-encrypt (warns "updating").                                                                                                               |
| Existing `.gpg` can't be decrypted for compare       | Warn, proceed to create new.                                                                                                                 |
| `--all` + `-e` or `-i`                               | Throw "Cannot use --all with --environment flag" / "Interactive mode is not compatible with --all".                                          |
| Confirm declined (non-interactive, no `--overwrite`) | "Operation cancelled", 0 files.                                                                                                              |
| GPG missing                                          | `GPG_ERROR (4)`.                                                                                                                             |
| Any file fails to encrypt                            | Per-file error; single-stage exits `GENERAL_ERROR (1)` if any errors; `--all` continues other stages and exits `1` only if total errors > 0. |

`--all` processes stages **sequentially and independently** — one failure doesn't
stop the rest — and prints an overall summary.

## Programmatic helper

`encryptEnvironment(env, cwd, passphrase?)` runs a single stage with
`overwrite: true`. Used by `init` to offer post-setup encryption.

## Exit codes

`SUCCESS 0` · `GENERAL_ERROR 1` (encrypt failures) · `GPG_ERROR 4` (gpg missing).

## Related

- [feature-decrypt](./feature-decrypt.md) · [commands.md](../commands.md) ·
  [adr/0001](../../adr/0001-gpg-symmetric-encryption.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |

---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Feature: `envx decrypt`

## Summary

Decrypt `.env.<stage>.gpg` files back to plaintext `.env.<stage>`. Mirror of
`encrypt`. Source: `src/commands/decrypt.ts`.

## Usage

```bash
envx decrypt -e production
envx decrypt --all
envx decrypt -e production --dry-run
envx decrypt -e development --overwrite
envx decrypt -e staging -i
```

## Flags

Same shape as `encrypt`:

| Flag                      | Meaning                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| `-e, --environment <env>` | Stage to decrypt. Required unless `--all`.                          |
| `-a, --all`               | All discovered environments. Mutually exclusive with `-e` and `-i`. |
| `-p, --passphrase <pass>` | Decryption passphrase.                                              |
| `-s, --secret <secret>`   | Secret var name in `.envrc`.                                        |
| `-i, --interactive`       | Pick which `.gpg` files to decrypt.                                 |
| `--overwrite`             | Overwrite existing plaintext without confirmation.                  |
| `--dry-run`               | Preview; make no changes.                                           |
| `-c, --cwd <path>`        | Working directory.                                                  |

## Behavior

1. `--all` rejects `-e` and `-i`.
2. `isGpgAvailable()` guard → `GPG_ERROR (4)` if missing.
3. Discover environments; resolve stage (auto/prompt/validate).
4. Resolve passphrase (`-p` → `-s` → `<STAGE>_SECRET` → prompt) and
   `testGpgOperation`.
5. `findEnvFiles` → keep encrypted, existing files. None → warn, suggest
   `encrypt`, return.
6. **Backup safety:** before overwriting an existing plaintext file, create a
   timestamped backup. On successful decrypt, remove the backup; on failure,
   restore it.
7. `decryptFile(encryptedPath, plaintextPath, passphrase)`.

## Overwrite / confirmation logic

- If decrypting would overwrite existing plaintext files and neither `--overwrite`
  nor `--all` is set → list them and ask to continue.
- If no conflicts and not interactive/all and no `--overwrite` → ask to confirm
  the operation.

## Edge cases (from code)

| Scenario                                   | Behavior                                        |
| ------------------------------------------ | ----------------------------------------------- |
| No `.gpg` files for stage                  | Warn "No encrypted … found", suggest `encrypt`. |
| Existing plaintext, no `--overwrite`       | Prompt with the conflict list.                  |
| Decrypt fails (wrong passphrase / corrupt) | Restore backup, report error, count failure.    |
| `--all` + `-e`/`-i`                        | Throw mutual-exclusion error.                   |
| GPG missing                                | `GPG_ERROR (4)`.                                |
| Any failure (single stage)                 | Exit `GENERAL_ERROR (1)`.                       |

Every successful decrypt path prints a **security notice**: decrypted files
contain sensitive data — don't commit them.

## Exit codes

`SUCCESS 0` · `GENERAL_ERROR 1` · `GPG_ERROR 4`.

## Related

- [feature-encrypt](./feature-encrypt.md) · [feature-run](./feature-run.md)
  (decrypt without disk) · [commands.md](../commands.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |

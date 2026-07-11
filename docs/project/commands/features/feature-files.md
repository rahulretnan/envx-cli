---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Feature: `envx files`

## Summary

Register arbitrary secret files — service account JSON, certificates, keystores,
anything that isn't a `.env.<stage>` file — and encrypt/decrypt them with the same
GPG machinery as `envx encrypt`/`envx decrypt`. Registrations live in `.envxrc`'s
`files` array. Source: `src/commands/files.ts`.

## Usage

```bash
envx files add certs/signing.p12                            # global — FILES_SECRET
envx files add android/google-services.json -e production   # stage-bound
envx files add secrets.json --no-gitignore                   # skip .gitignore write
envx files list                                               # registry + status
envx files remove certs/signing.p12                           # unregister
envx files encrypt                                             # encrypt all registered
envx files encrypt certs/signing.p12                           # encrypt one
envx files decrypt --overwrite                                 # decrypt all, no prompts
envx files encrypt --dry-run                                   # preview only
```

## Flags

| Flag                            | Subcommands          | Meaning                                                       |
| ------------------------------- | -------------------- | ------------------------------------------------------------- |
| `-e, --environment <env>`       | `add`                | Bind the file to a stage. Omit for a global file.             |
| `--no-gitignore`                | `add`                | Skip appending the path to `.gitignore`.                      |
| `-p, --passphrase <passphrase>` | `encrypt`, `decrypt` | Passphrase to use directly.                                   |
| `-s, --secret <secret>`         | `encrypt`, `decrypt` | Secret variable name to read from `.envrc`.                   |
| `--overwrite`                   | `decrypt`            | Skip the overwrite confirmation for existing plaintext files. |
| `--dry-run`                     | `encrypt`, `decrypt` | Report what would happen; never calls GPG or touches files.   |
| `-c, --cwd <path>`              | all                  | Working directory.                                            |

`encrypt [path]` / `decrypt [path]` operate on every registered file when `path` is
omitted, or on a single entry (matched by its registered root-relative path) when
given.

## Behavior

1. **Registry location**: `getRegisteredFiles(cwd)` walks upward (via
   `findEnvxrcUpward`) to the nearest `.envrc`/`.envxrc`/`.git` ancestor and reads
   its `.envxrc`'s `files` array. That ancestor is the `root` all entry paths are
   resolved against — same project-root convention as `.envxrc`/`.envrc` discovery
   elsewhere in the CLI.
2. **`add <path>`**: resolves `path` relative to `cwd`, re-bases it onto `root`
   (`rebaseToRoot`, POSIX separators), and validates it with `registeredFileSchema`
   (rejects absolute paths, `.gpg` paths, and `..` segments). Warns (no-op) on a
   duplicate registration. Prompts for confirmation if the file doesn't exist yet.
   Warns if the plaintext path is already tracked by git (`isPathTrackedByGit`) —
   the secret may already be in history. Writes the updated array via
   `FileUtils.mergeEnvxrc`. Unless `--no-gitignore`, appends the path plus
   `!<path>.gpg` to `.gitignore` under an `# EnvX files` section
   (`addFilesToGitignore`) so the encrypted sibling stays committable.
3. **`remove <path>`**: re-bases and removes the matching entry; warns (no-op) if
   not registered. `.gitignore` is left untouched by design.
4. **`list`**: prints every registered entry with its stage (or `global`), whether
   the plaintext/encrypted copies exist on disk, and a status label
   (`getRegisteredFileStatus`: Encrypted / Encrypted only / Unencrypted / Missing).
5. **`encrypt` / `decrypt`** (`processRegisteredFiles`, the shared engine also used
   by the encrypt/decrypt ride-along):
   - Groups the selected entries by secret variable — `<STAGE>_SECRET` for
     stage-bound entries, `FILES_SECRET` for global entries.
   - Resolves one passphrase per group: `passphraseOverride` (ride-along) →
     `-p` → `-s <name>` in `.envrc` → `<secretVar>` in `.envrc` → interactive
     prompt (skipped entirely on `--dry-run`).
   - GPG-tests each distinct passphrase once (`testGpgOperation`) before touching
     files in that group.
   - **Encrypt**: skips (counts success) a file whose existing `.gpg` decrypts to
     content identical to the current plaintext; otherwise re-encrypts. Missing
     plaintext is skipped with a warning (or an info note if only the `.gpg`
     exists).
   - **Decrypt**: skips with a warning if no `.gpg` exists. If a plaintext already
     exists, prompts to overwrite unless `--overwrite` or `isPartOfAll` (ride-along
     under `--all`) is set. Takes a backup before writing, removes it on success,
     restores it and reports an error on GPG failure.
   - `--dry-run` reports every selected entry's would-be action and its secret
     variable without invoking GPG.

## Passphrase resolution

Per secret-variable group: `passphraseOverride` (ride-along only) > `-p` >
`-s <name>` (`.envrc`) > `<STAGE>_SECRET` or `FILES_SECRET` (`.envrc`) > interactive
prompt.

## Ride-along with `encrypt`/`decrypt`

`envx encrypt -e <stage>` / `envx decrypt -e <stage>` call `processRegisteredFiles`
on the subset of entries bound to that stage, passing the passphrase already
resolved for the stage as `passphraseOverride` — no second prompt. `envx encrypt
--all` / `envx decrypt --all` pass **every** registered entry (stage-bound and
global) with `isPartOfAll: true`, so global entries are resolved against
`FILES_SECRET` and existing-plaintext confirmation prompts are skipped the same way
`--all` skips them for `.env.<stage>` files. See
[feature-encrypt](./feature-encrypt.md) / [feature-decrypt](./feature-decrypt.md).

## Edge cases (from code)

| Scenario                                            | Behavior                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `add` a path already registered                     | Warn, no write.                                                               |
| `add` a `.gpg` path                                 | Zod rejects: "Register the plaintext path, not the .gpg file".                |
| `add` an absolute path or one escaping the root     | Zod rejects / `rebaseToRoot` throws.                                          |
| `add` a file that doesn't exist yet                 | Confirmation prompt; declining cancels the operation.                         |
| `add` a path already tracked by git                 | Warning suggesting `git rm --cached` after encrypting; registration proceeds. |
| `remove` a path not registered                      | Warn, no write.                                                               |
| `encrypt`/`decrypt <path>` for an unregistered path | Throws `'<path>' is not registered.` → `INVALID_ARGS (2)`.                    |
| No files registered                                 | Warn and return; `list` suggests `envx files add`.                            |
| `.envxrc` write fails (`add`/`remove`)              | `FILE_ERROR (3)`.                                                             |
| GPG unavailable (`encrypt`/`decrypt`, not dry-run)  | `GPG_ERROR (4)` with install help.                                            |
| GPG test fails for a secret variable's group        | That group's entries all count as errors; other groups still processed.       |
| Any file fails to encrypt/decrypt                   | `GENERAL_ERROR (1)` after reporting the per-file failure count.               |

## Exit codes

`SUCCESS 0` · `GENERAL_ERROR 1` (crypto failures) · `INVALID_ARGS 2` (unregistered
path given to `encrypt`/`decrypt`) · `FILE_ERROR 3` (`.envxrc` write failure) ·
`GPG_ERROR 4` (gpg missing).

## Related

- [feature-encrypt](./feature-encrypt.md) · [feature-decrypt](./feature-decrypt.md) ·
  [feature-interactive](./feature-interactive.md) (offers `FILES_SECRET` when a
  global file is registered) · [commands.md](../commands.md) ·
  [adr/0002](../../adr/0002-envrc-envxrc-split.md)

## Changelog

| Version | Date       | Changes                                  |
| ------- | ---------- | ---------------------------------------- |
| 1.0     | 2026-07-12 | Initial draft — `envx files` implemented |

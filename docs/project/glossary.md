---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Scope: Project-wide
---

# Glossary

| Term                          | Meaning                                                                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stage** / **environment**   | A named configuration set — `local`, `development`, `staging`, `production`, or any custom name. Materialized as a `.env.<stage>` file. Used interchangeably in the codebase (`environment` in options, `stage` in a few types). |
| **`.env.<stage>`**            | Plaintext environment file for a stage. Git-ignored; local-only.                                                                                                                                                                 |
| **`.env.<stage>.gpg`**        | GPG-encrypted form of a stage file. **Committable** — this is what goes in version control.                                                                                                                                      |
| **`.env`**                    | The "active" plaintext file an app actually loads. Produced by `envx copy`. Not managed as a stage.                                                                                                                              |
| **`.envrc`**                  | direnv-style shell file holding **GPG passphrases** as `export STAGE_SECRET="…"`. Git-ignored. Discovered by walking upward from `cwd`.                                                                                          |
| **`.envxrc`**                 | JSON **project config** (`ignore`, `excludeDirs`, `environments`). **Committed and shared.** Discovered by walking upward from `cwd`.                                                                                            |
| **Secret**                    | The passphrase used to encrypt/decrypt a stage. By convention named `<STAGE>_SECRET` (uppercased) in `.envrc`.                                                                                                                   |
| **Secret variable name**      | `generateSecretVariableName(stage)` → `${STAGE.toUpperCase()}_SECRET`. How EnvX maps a stage to its `.envrc` entry.                                                                                                              |
| **Project root**              | First ancestor of `cwd` (inclusive) containing any of `.envrc`, `.envxrc`, or `.git`. Determines where upward config discovery stops.                                                                                            |
| **Ignore pattern**            | A stage name filtered out of discovery (`--all`, `list`, `status`, `init`). Case-insensitive exact match. Defaults: `example`, `sample`, `template`. Held in `.envxrc.ignore`; `[]` disables filtering.                          |
| **Exclude dir**               | A directory name skipped during `fast-glob` discovery (e.g. `node_modules`, `dist`, `.next`). Held in `.envxrc.excludeDirs`; keeps stray `.env.*` inside build output from appearing.                                            |
| **`--all` (encrypt/decrypt)** | Process **all discovered environments** plus **all registered files** (stage-bound with their stage secret, globals with `FILES_SECRET`). Works in files-only projects too. Mutually exclusive with `-e`.                        |
| **`--all` (copy)**            | Process **all directories** containing that stage's files. Here `-e` is **required**. Different semantics from encrypt/decrypt.                                                                                                  |
| **Dry run**                   | `--dry-run` — print what would happen (files, passphrase source, or for `run` the source list + key names) and exit without changing anything. Never prints secret values.                                                       |
| **In-memory decrypt**         | `envx run` decrypts via `decryptFileToString` and injects into a sub-process env; plaintext never hits disk.                                                                                                                     |
| **`ExitCode`**                | Enum of process exit codes: `SUCCESS 0`, `GENERAL_ERROR 1`, `INVALID_ARGS 2`, `FILE_ERROR 3`, `GPG_ERROR 4`, `USER_CANCELLED 5`.                                                                                                 |

## Related

- [architecture-overview.md](./architecture-overview.md)
- [commands/commands.md](./commands/commands.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |

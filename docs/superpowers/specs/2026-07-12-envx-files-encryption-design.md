# envx files — Arbitrary Secret-File Encryption (Design)

**Date:** 2026-07-12
**Status:** Approved
**Feature:** Encrypt/decrypt arbitrary non-`.env` secret files (e.g.
`google-services.json`, `GoogleService-Info.plist`, signing certs, service
account keys) alongside the existing stage-based `.env` encryption — without
changing any existing behavior.

## Motivation

EnvX today only manages `.env.<stage>` files. Real projects carry other secret
files that would benefit from the same commit-encrypted workflow: Firebase
config files (often one per environment), iOS plists, `.p12`/keystore signing
material, service-account JSON. Teams currently either git-ignore these and
share them out of band, or hand-roll `gpg` calls. EnvX already has the crypto,
passphrase, and gitignore machinery — this feature exposes it for arbitrary
files.

## Feasibility notes (from code audit)

- `ExecUtils.encryptFile(path, passphrase)` / `decryptFile(enc, out, pass)` are
  already file-agnostic and binary-safe (passphrase via stdin, `gpg -c`).
  No changes needed at the crypto layer.
- `FileUtils.filesAreIdentical` compares md5 over buffers — binary-safe, so the
  existing "skip if unchanged" idempotency check works for these files too.
- Discovery (`findAllEnvironments`) matches only `^\.env\.([^.]+)(\.gpg)?$`
  basenames, so registered files and their `.gpg` siblings are invisible to all
  existing commands. No collision.
- `envxrcFileConfigSchema` is a Zod object with optional fields; adding a
  `files` field is backward compatible (older envx strips unknown keys).

## Design decisions (agreed)

1. **Stage model: stage-optional.** A registered file MAY be bound to a stage
   (Firebase per-env pattern) or be global (one cert for all environments).
2. **Global passphrase: `FILES_SECRET` convention** in `.envrc`, parallel to
   `<STAGE>_SECRET`. No per-file secret override in v1.
3. **CLI surface: blend + `envx files` management.** Registered files ride
   along existing `encrypt`/`decrypt`/`list`/`status`; a new `envx files`
   subcommand manages the registry and offers file-only operations.
4. **`files add` auto-updates `.gitignore`** (opt-out via `--no-gitignore`).
5. **No globs in v1** — literal paths only. Globs are a possible v2.
6. **`init` unchanged in v1** — auto-discovery of well-known secret files
   (google-services.json etc.) is a possible v2.

## 1. Registry — `.envxrc` `files` field

```json
{
  "ignore": ["example", "sample", "template"],
  "environments": ["development", "production"],
  "files": [
    { "path": "android/google-services.json", "stage": "production" },
    { "path": "android/google-services.dev.json", "stage": "development" },
    { "path": "certs/signing.p12" }
  ]
}
```

- Schema addition (additive, optional):
  `files?: Array<{ path: string; stage?: string }>`.
- `path` rules, enforced by schema/validation:
  - relative to the `.envxrc` location (project root), stored normalized with
    POSIX separators;
  - absolute paths rejected;
  - paths escaping the root (`..` after normalization) rejected;
  - must not end in `.gpg` (register the plaintext, not the ciphertext).
- `stage` must satisfy the existing environment-name rule
  (`^[a-zA-Z0-9_-]+$`). It is NOT required to match a discovered environment —
  the registry may be set up before the stage's `.env` file exists.
- Reads/writes go through the existing `readEnvxrc` / `mergeEnvxrc` (upward
  walk; writes target the nearest existing `.envxrc`), so `envx files add`
  from a monorepo subdirectory edits the root config. Paths supplied relative
  to `cwd` are re-based to be root-relative before storage.

## 2. Encryption model

- On disk: `<path>.gpg` next to the original — identical convention to
  `.env.<stage>.gpg`. Reuses `getEncryptedPath` / `isEncryptedFile`.
- Registered files are resolved **only** via the registry. They are never
  discovered by globbing and never affect environment discovery.
- Encrypt idempotency mirrors `encrypt` today: if `<path>.gpg` exists, decrypt
  to a temp file, hash-compare, skip when identical, re-encrypt when changed,
  always clean up the temp file. (Temp file handling identical to
  `encrypt.ts`'s existing flow.)
- Decrypt safety mirrors `decrypt` today: back up existing plaintext before
  overwriting; restore on failure; remove backup on success.

## 3. Passphrase resolution

| File kind   | Resolution chain                                                        |
| ----------- | ----------------------------------------------------------------------- |
| Stage-bound | `-p` flag → `-s NAME` (`.envrc`) → `<STAGE>_SECRET` (`.envrc`) → prompt |
| Global      | `-p` flag → `-s NAME` (`.envrc`) → `FILES_SECRET` (`.envrc`) → prompt   |

- `.envrc` is read via `readEnvrcNearest` (upward walk), as everywhere else.
- Batch operations group by required secret so each passphrase is resolved
  (and GPG-tested) once per group, not once per file.
- `envx interactive` offers to set `FILES_SECRET` **only when the registry
  contains at least one global (stage-less) file**. Users who don't use the
  feature never see the step.

## 4. Command surface

### New: `src/commands/files.ts`

Follows the existing pattern: `createFilesCommand()` returning a Commander
command with subcommands, plus exported `executeXxx()` functions. Modeled on
`config.ts`'s subcommand structure.

```bash
envx files add <path> [-e <stage>] [--no-gitignore] [-c <cwd>]
envx files remove <path> [-c <cwd>]
envx files list [-c <cwd>]
envx files encrypt [<path>] [--dry-run] [-p <pass>] [-s <secret>] [-c <cwd>]
envx files decrypt [<path>] [--dry-run] [--overwrite] [-p <pass>] [-s <secret>] [-c <cwd>]
```

**`files add <path>`**

1. Resolve `path` against `cwd`; re-base to project root; validate path rules.
2. Warn + confirm if the file does not exist on disk yet (registering ahead of
   time is allowed but should be deliberate).
3. Warn if the plaintext path is currently tracked by git (checked via
   `git ls-files --error-unmatch <path>`, silent, only when a `.git` root
   exists) — the secret may already be in history.
4. Case-sensitive dedupe against existing entries → warn no-op (mirrors
   `config ignore add`).
5. `mergeEnvxrc` with the new entry appended.
6. Unless `--no-gitignore`: append to `.gitignore` under an `# EnvX files`
   section: the exact plaintext path and `!<path>.gpg`. Skip lines already
   present (same containment check `updateGitignore` uses).

**`files remove <path>`** — registry only. `.gitignore` lines are left in
place (removing ignore rules is riskier than leaving them). Warn no-op if not
registered.

**`files list`** — table: Path · Stage (or `global`) · Plaintext (present/—) ·
Encrypted (present/—) · Status (`Encrypted` / `Unencrypted` / `Encrypted only`
/ `Missing`).

**`files encrypt [<path>]`** — all registered files, or just one. A `<path>`
argument is resolved against `cwd`, re-based to root-relative, and must match
a registry entry (error `INVALID_ARGS` otherwise). Groups by
secret, resolves passphrases per §3, `testGpgOperation` per distinct
passphrase, then per-file encrypt with the idempotency check. `--dry-run`
prints the would-encrypt list and passphrase sources, changes nothing.

**`files decrypt [<path>]`** — mirror of `files encrypt`, with the
backup/restore behavior and the same overwrite-confirmation logic `decrypt`
uses today (`--overwrite` skips it).

### Ride-along changes to existing commands

| Command                                | Change                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `encrypt -e <stage>`                   | After env files, also process files registered with that stage (same passphrase, already resolved).                                                       |
| `encrypt --all`                        | After all stages, also process **all** registered files — stage-bound with their stage secret, globals with `FILES_SECRET`. Summary gains a `files` line. |
| `decrypt -e <stage>` / `decrypt --all` | Mirror of encrypt ride-along.                                                                                                                             |
| `list`                                 | Extra "Registered files" section (from `files list` rendering).                                                                                           |
| `status`                               | File counts included; an unencrypted registered file yields a recommendation ("Encrypt registered file certs/signing.p12").                               |
| `interactive`                          | Optional `FILES_SECRET` step (§3).                                                                                                                        |

Ride-along failures follow the existing `--all` philosophy: per-item errors
are counted, processing continues, and the process exits `GENERAL_ERROR (1)`
if any errors occurred.

## 5. Explicitly unchanged

- `run` and `copy` — env-var injection and `.env` activation do not apply to
  arbitrary files; a registered file's "activation" is its decrypted plaintext
  in place.
- Environment discovery (`findAllEnvironments`, `findEnvFiles`) and the
  `.env.*` regex.
- The `--all` semantics matrix (files are additive passengers, not a new mode).
- All existing Zod schemas except the additive `.envxrc` field; all existing
  flags and their meanings.
- `init` (v1).

## 6. Edge cases

| Case                                                | Behavior                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| Registered file missing at encrypt time             | Warn + skip; batch continues                                      |
| Only `.gpg` exists (plaintext deleted)              | Encrypt: skip with note; decrypt: works; `list`: "Encrypted only" |
| Neither plaintext nor `.gpg` exists                 | `list`: "Missing"; encrypt/decrypt: warn + skip                   |
| Duplicate `files add`                               | Warn no-op                                                        |
| `files add` of a `.gpg` path                        | Reject with message ("register the plaintext path")               |
| Absolute or root-escaping path                      | Reject (schema/validation)                                        |
| Stage-bound file whose stage has no `.envrc` secret | Falls through to prompt, exactly like env encrypt today           |
| Per-file failure in batch                           | Counted; continue; exit `GENERAL_ERROR (1)` at end                |
| Wrong passphrase on decrypt                         | Backup restored; error reported; non-zero exit                    |

## 7. Exit codes

Existing `ExitCode` enum, no additions: `SUCCESS 0`, `GENERAL_ERROR 1`
(operation failures), `INVALID_ARGS 2` (bad paths/flags), `FILE_ERROR 3`,
`GPG_ERROR 4` (gpg missing / crypto failure), `USER_CANCELLED 5`.

## 8. Testing

**Core (`__tests__/core/`):**

- Schema: `files` field validation — accepts `{path}`, `{path, stage}`;
  rejects absolute paths, `..` escapes, `.gpg` paths, bad stage names.
- Registry ops: add/remove/list logic, cwd→root path re-basing, dedupe,
  no-op warnings.
- Passphrase mapping: stage-bound → `<STAGE>_SECRET`; global → `FILES_SECRET`;
  flag and `-s` overrides.
- Gitignore update: new "EnvX files" section, exact-path + `!<path>.gpg`
  lines, idempotent re-runs. Update the pattern-count assertions in
  `file.test.ts` if `updateGitignore`'s arrays change (per CLAUDE.md).

**Integration (`__tests__/integration/cli.test.ts`):**

- `files add` → `.envxrc` written, `.gitignore` updated.
- Ride-along: `encrypt -e <stage>` picks up the stage-bound file;
  `encrypt --all` picks up globals.
- Round-trip on a small **binary** fixture (e.g. a few hundred random bytes as
  a fake `.p12`): encrypt → delete plaintext → decrypt → byte-identical.
- `files list` / `list` / `status` rendering presence (not styling).
- Requires `npm run build` first (existing integration-test gate).

## 9. Future (out of scope for v1)

- Glob patterns in the registry (`certs/*.p12`).
- `init` auto-discovery of well-known secret files.
- Per-file secret override (`{ path, secret: "SIGNING_SECRET" }`).
- `files remove --prune-gitignore`.

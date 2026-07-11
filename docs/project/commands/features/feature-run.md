---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Feature: `envx run`

## Summary

Decrypt an env source **in memory** and run a command with those variables
injected into its environment. Plaintext never touches disk. Inspired by
`dotenvx run`. Source: `src/commands/run.ts`. Full design:
[adr/0004](../../adr/0004-run-in-memory-decrypt.md).

## Usage

```bash
envx run -e production -- node server.js
envx run -f .env.local -- npm run dev
envx run -f .env -f .env.local -- vitest          # later file wins
envx run -e staging --env LOG_LEVEL=debug -- npm test
envx run -e production -f .env.overrides --overload -- npm start
envx run -e production --dry-run -- npm start      # key names only
```

The `--` separator passes everything after it literally to the sub-process.

## Flags

| Flag                        | Meaning                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `-e, --environment <stage>` | Load `<cwd>/.env.<stage>.gpg` (preferred) or `.env.<stage>`. **cwd-only, no upward walk.** |
| `-f, --env-file <path>`     | Explicit env file (repeatable). `.gpg` suffix ⇒ decrypt.                                   |
| `--env <KEY=VAL>`           | Inline override (repeatable).                                                              |
| `-p, --passphrase <pass>`   | GPG passphrase; only used if a source is encrypted. Falls back to `.envrc` then prompt.    |
| `--overload`                | Let files+inline beat existing `process.env`.                                              |
| `--dry-run`                 | Print resolved sources + injected key names, then exit. Never prints values.               |
| `-c, --cwd <path>`          | Working dir for resolution and the sub-process.                                            |

## Source & precedence

**Merge order (lowest → highest):** stage (`-e`) → files (`-f`, argv order) →
inline (`--env`, argv order).

1. **`process.env` wins** over file values unless `--overload`.
2. Within sources, later overrides earlier.
3. When both `.env.<stage>` and `.env.<stage>.gpg` exist, the **encrypted** file
   wins (`resolveStageFile`). No silent fallback to plaintext if decryption fails.
4. `${VAR}` expansion via `dotenv-expand` (own keys + `process.env`, non-mutating).
   Command substitution `$(...)` is **not** supported.

## Behavior

1. `validateRunOptions` (Zod). Resolve `cwd`.
2. `collectRawSources`. Require ≥1 source and a command after `--`, else
   `INVALID_ARGS (2)`.
3. Resolve each source to a file (existence-checked) or inline pair.
4. **Passphrase only if some source is encrypted:** `-p` → `<STAGE>_SECRET` in
   nearest `.envrc` (upward walk, only for the `-e` stage) → prompt.
5. `loadEnvSource` decrypts encrypted files to an in-memory string
   (`decryptFileToString`) and parses; plain files are read + parsed.
6. `mergeEnv(loadedSources, process.env, overload)` — parent env never mutated.
7. `--dry-run` → print and exit `0`, no spawn.
8. `spawnChildWithEnv(argv, finalEnv, cwd)` with `shell: false`; forward
   SIGINT/SIGTERM/SIGHUP; **propagate the child's exit code**.

## Security notes

- `shell: false` — argv passed literally, no `$VAR`/`&&`/`|`/glob interpretation.
  For shell features: `envx run -e prod -- sh -c 'a && b'`.
- `--dry-run` prints key names only — safe to paste into issues/logs.
- Decryption failure exits non-zero (`GPG_ERROR 4`); no fallback to a plaintext
  sibling.
- The child's exit code is the parent's exit code.

## Edge cases (from code)

| Scenario                          | Behavior                                                                   |
| --------------------------------- | -------------------------------------------------------------------------- |
| No sources                        | `INVALID_ARGS (2)`: "At least one of --environment, --env-file, or --env". |
| No command after `--`             | `INVALID_ARGS (2)`.                                                        |
| Stage file missing                | `FILE_ERROR (3)` listing both looked-for paths.                            |
| `-f` file missing                 | `FILE_ERROR (3)`.                                                          |
| Bad `--env` (no `=` or empty key) | Throw "requires KEY=VALUE format".                                         |
| Decrypt fails                     | `GPG_ERROR (4)`.                                                           |
| Child killed by signal            | Signal re-raised on parent so wait-status reflects it.                     |

## Exit codes

`SUCCESS 0` (or child's code) · `INVALID_ARGS 2` · `FILE_ERROR 3` · `GPG_ERROR 4`
· `GENERAL_ERROR 1` (spawn failure).

## Related

- [feature-decrypt](./feature-decrypt.md) · [feature-copy](./feature-copy.md) ·
  [adr/0004](../../adr/0004-run-in-memory-decrypt.md) ·
  [architecture-overview.md](../../architecture-overview.md) §5

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |

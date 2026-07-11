---
Status: Accepted
Date: 2026-07-12 (back-filled)
---

# ADR 0004 — `envx run` decrypts in memory; plaintext never touches disk

## Context

A common need is to run a process with a stage's secrets loaded
(`node server.js`, `npm test`) without first decrypting to a `.env` file that then
lingers on disk and risks being committed. This is what `dotenvx run` does.

## Decision

`envx run` decrypts sources **in memory** and injects them into a spawned
sub-process's environment:

- Encrypted sources go through `ExecUtils.decryptFileToString` →
  `FileUtils.parseEnvContent`; the plaintext exists only as an in-process string.
- Nothing is written to disk. When the sub-process exits, the plaintext is gone.
- The sub-process is spawned with `shell: false` (argv passed literally, no shell
  interpolation) and `SIGINT`/`SIGTERM`/`SIGHUP` are forwarded so Ctrl-C
  propagates. The child's exit code propagates back to the parent.

### Precedence (dotenvx-style)

1. `process.env` wins over file values unless `--overload`.
2. Within sources, later wins: stage (`-e`) → files (`-f`, argv order) → inline
   (`--env`, argv order).
3. When both `.env.<stage>` and `.env.<stage>.gpg` exist, the **encrypted** file
   wins. No silent fallback to plaintext on decryption failure — it exits non-zero.
4. `${VAR}` expansion via `dotenv-expand`; command substitution `$(...)` is **not**
   supported.

## Consequences

**Positive**

- No plaintext secret file to accidentally commit or leave behind.
- `--dry-run` prints the source list and injected **key names only** — safe to
  paste into issues/logs.
- Passphrase resolution reuses the same flag → `.envrc` → prompt chain, and is
  only requested when a source is actually encrypted.

**Negative / trade-offs**

- Shell features (`$VAR`, `&&`, `|`, globs) are not interpreted in argv; users must
  wrap explicitly: `envx run -e prod -- sh -c 'a && b'`. This is a deliberate
  safety choice (avoids injection), documented in the security notes.
- Secrets live in the sub-process environment, visible to that process and its
  children — inherent to env-injection, not specific to EnvX.

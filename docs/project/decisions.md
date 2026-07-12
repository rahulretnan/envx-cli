---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Scope: Project-wide
---

# Decisions

Index of architecture decisions. Each links to a full ADR. These were
back-filled from the existing implementation on 2026-07-12.

| ADR                                            | Decision                                                                                                                                          | Status   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [0001](./adr/0001-gpg-symmetric-encryption.md) | Symmetric GPG (`gpg -c`) with a per-stage passphrase, not asymmetric keys                                                                         | Accepted |
| [0002](./adr/0002-envrc-envxrc-split.md)       | Split config: `.envrc` (secret passphrases incl. `FILES_SECRET`, git-ignored) vs `.envxrc` (project config incl. the `files` registry, committed) | Accepted |
| [0003](./adr/0003-upward-config-discovery.md)  | Discover `.envrc`/`.envxrc` by walking upward to the project root; stage files stay cwd-local                                                     | Accepted |
| [0004](./adr/0004-run-in-memory-decrypt.md)    | `envx run` decrypts in memory and injects into a sub-process; plaintext never touches disk                                                        | Accepted |

## Cross-cutting conventions (not full ADRs)

- **Static utility classes.** `ExecUtils`, `CliUtils`, `FileUtils`,
  `InteractiveUtils` expose static methods only — no instances, no DI. Simplest
  thing for a stateless CLI.
- **Command pattern.** Every command file exports `createXxxCommand()` (Commander
  wiring) + `executeXxx()` (logic), so logic is unit-testable without argv.
- **Zod at the boundary.** All command inputs validate through Zod; the `--all`
  flag swaps to a permissive schema at runtime rather than a separate command.
- **Passphrase never in argv.** Fed to `gpg` via stdin with
  `--pinentry-mode loopback`. A security invariant, not a preference — see
  [tech-stack.md](./tech-stack.md#passphrase-handling-security-relevant).
- **Encrypted wins.** When both `.env.<stage>` and `.env.<stage>.gpg` exist, the
  encrypted file is treated as the source of truth (in `run` and `resolveStageFile`).

## Changelog

| Version | Date       | Changes                                                       |
| ------- | ---------- | ------------------------------------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered index (ADRs 0001–0004 back-filled) |

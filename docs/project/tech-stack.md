---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Scope: Project-wide
---

# Tech Stack

EnvX is a Node.js CLI written in TypeScript (strict mode), distributed on npm as
`envx-cli` with a single `envx` bin. It shells out to the system `gpg` binary for
all cryptography — it ships no crypto of its own.

## Runtime & language

| Concern  | Choice                               | Notes                                            |
| -------- | ------------------------------------ | ------------------------------------------------ |
| Language | TypeScript 5.3, `strict`             | Path alias `@/* → src/*`                         |
| Runtime  | Node.js `>=14`                       | `engines.node` in `package.json`                 |
| Build    | `tsc` → `dist/`                      | `main: dist/index.js`, `bin.envx: dist/index.js` |
| Crypto   | System **GPG** (symmetric, `gpg -c`) | Never bundled; availability checked at runtime   |

## Production dependencies

| Package         | Role in EnvX                                                            |
| --------------- | ----------------------------------------------------------------------- |
| `commander`     | CLI framework — program, subcommands, flags, `--` passthrough for `run` |
| `chalk`         | Colored terminal output (via `CliUtils`)                                |
| `inquirer`      | Interactive prompts — confirmations, passphrase input, env selection    |
| `fast-glob`     | Environment-file discovery (`**/.env.*`) with `excludeDirs` ignored     |
| `fs-extra`      | Promise-based filesystem ops, backups, `ensureDir`                      |
| `shelljs`       | Sync file ops (`cp`, `mv`, `rm`, `test`), `pwd`, GPG availability check |
| `dotenv`        | Tokenize `.env` content in `run` (`dotenv.parse`)                       |
| `dotenv-expand` | `${VAR}` expansion inside env values, non-mutating                      |
| `lodash`        | Small helpers (`replace` for `.gpg` suffix handling)                    |
| `zod`           | Input validation for every command; drives the `--all` schema switch    |

## Tooling

| Concern   | Choice                                                                      |
| --------- | --------------------------------------------------------------------------- |
| Tests     | Jest + `ts-jest` (`__tests__/core`, `__tests__/integration`)                |
| Lint      | ESLint (`typescript-eslint`) + `eslint-config-prettier`                     |
| Format    | Prettier — single quotes, semicolons, es5 trailing commas, 2-space, 80 cols |
| Git hooks | Husky + lint-staged (ESLint + Prettier on staged files)                     |
| Release   | `release-it` + `@release-it/conventional-changelog`                         |

## Why GPG symmetric, not asymmetric / a key server

Symmetric `gpg -c` with a per-stage passphrase means the only shared secret is a
string in `.envrc`. No keyrings to distribute, no key server, no per-recipient
re-encryption. The trade-off — everyone with the passphrase can decrypt — is
acceptable for the "commit encrypted env files, share the passphrase out of band"
workflow EnvX targets. See [adr/0001-gpg-symmetric-encryption.md](./adr/0001-gpg-symmetric-encryption.md).

## Passphrase handling (security-relevant)

The passphrase is **never placed in `argv`**. All `gpg` invocations use
`--passphrase-fd 0 --pinentry-mode loopback --batch` and the passphrase is piped
via `spawnSync`'s `input` (stdin). It is therefore not visible in `ps`,
`/proc/<pid>/cmdline`, or execve audit logs. See `ExecUtils.gpgBaseArgs` /
`runGpg` in `src/utils/exec.ts`.

## Related

- [architecture-overview.md](./architecture-overview.md)
- [decisions.md](./decisions.md)

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |

---
Status: Implemented
Version: 1.0
Owner: Rahul Retnan
Last Updated: 2026-07-12
Module: Commands
---

# Test Plan

EnvX uses Jest + `ts-jest`. Tests focus on **user-facing behavior** — schemas,
file utilities, `.envxrc` handling, the `--all` matrix, command workflow logic —
and real CLI execution. UI/cosmetic output (chalk colors, inquirer styling) is
intentionally not tested. See also root [`TESTING.md`](../../TESTING.md).

## Suites

| Suite             | Location                                 | Covers                                                                            |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| Schemas           | `__tests__/core/schemas.test.ts`         | Zod input validation for every command; `--all` refinements                       |
| Files schema      | `__tests__/core/files-schema.test.ts`    | `registeredFileSchema` path rules; `.envxrc` `files` field                        |
| File utils        | `__tests__/core/file.test.ts`            | Discovery, path manipulation, secret generation, `updateGitignore` pattern counts |
| Files utils       | `__tests__/core/files-utils.test.ts`     | `getRegisteredFiles`, `rebaseToRoot`, `addFilesToGitignore`                       |
| Commands          | `__tests__/core/commands.test.ts`        | Workflow/decision logic patterns                                                  |
| Files command     | `__tests__/core/files-command.test.ts`   | `files add`/`remove` registry management                                          |
| Files engine      | `__tests__/core/files-engine.test.ts`    | `processRegisteredFiles` grouping, idempotency, dry-run, CLI wrappers             |
| Ride-along        | `__tests__/core/files-ridealong.test.ts` | encrypt/decrypt ride-along, interactive `FILES_SECRET` step                       |
| Review fixes      | `__tests__/core/review-fixes.test.ts`    | Cancellation, files-only projects, tmpdir isolation, reset preservation           |
| Git tracked       | `__tests__/core/git-tracked.test.ts`     | `isPathTrackedByGit` incl. injection-safety                                       |
| All-flag          | `__tests__/core/all-flag.test.ts`        | Batch operations, `--all` compatibility, independent per-item failure             |
| `.envxrc`         | `__tests__/core/envxrc.test.ts`          | read/write/merge, ignore filtering, defaults, upward discovery                    |
| Config command    | `__tests__/core/config.test.ts`          | `show`, ignore/exclude `add`/`remove`, `reset`                                    |
| Integration       | `__tests__/integration/cli.test.ts`      | Real CLI via `execSync` on `dist/index.js`                                        |
| Files integration | `__tests__/integration/files.test.ts`    | `files` end-to-end incl. binary round-trip and `--all` ride-along                 |

## How to run

```bash
npm test                  # all suites
npm run test:core         # __tests__/core only
npm run test:integration  # REQUIRES npm run build first (uses dist/)
npm run test:coverage
```

> **Integration gate:** integration tests exec the compiled `dist/index.js`, so
> run `npm run build` after any source change before `test:integration` or full
> `npm test`.

## Conventions

- Temp dirs via `fs.mkdtemp`, cleaned in `afterEach`.
- Core tests mock the filesystem / use temp dirs; integration tests run the real
  binary end-to-end.
- When adding patterns to `FileUtils.updateGitignore` (`envPatterns` /
  `secretPatterns`), update the pattern-count assertions in `file.test.ts`.
- Commander converts dashed flags to camelCase on the raw options object
  (`--dry-run` → `rawOptions.dryRun`, `--all-dirs` → `rawOptions.allDirs`); read
  flags accordingly in tests.

## What is deliberately out of scope

- Chalk color output and inquirer prompt rendering.
- GPG internals — EnvX trusts the system `gpg` binary; crypto correctness is
  GPG's responsibility. Tests that need GPG exercise the wrappers, not the cipher.

## Changelog

| Version | Date       | Changes                          |
| ------- | ---------- | -------------------------------- |
| 1.0     | 2026-07-12 | Initial reverse-engineered draft |

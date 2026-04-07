# `envx run` — Design Spec

**Date:** 2026-04-07
**Status:** Approved (brainstorming phase)
**Author:** Rahul Retnan + Claude (brainstorming session)

## Goal

Add a `run` command to envx that decrypts an encrypted env file in memory and spawns a sub-process with those variables injected into its environment. Inspired by `dotenvx run`. The defining property: **plaintext secrets never touch the disk**. Decryption happens in-process via GPG-stdout, parsed in memory, merged into a `process.env` snapshot, and handed to the spawned sub-process.

This unblocks the dominant runtime workflow: `envx run -e production -- npm start` instead of `envx decrypt -e production && npm start && rm .env.production`.

## Non-goals

- A long-running daemon, file watcher, or background process.
- Command substitution in env values (`FOO=$(curl ...)`) — security footgun, possibly never.
- A separate `envx export` / `envx printenv` command. Out of scope; if needed later, ship as its own command with explicit secret-leak warnings.
- Re-prompting on bad passphrase. First failure → exit.
- Recursive monorepo merging. `-e <stage>` is cwd-only; subdirectory packages must use `--cwd` or `--env-file`.
- Programmatic Node API. Internal helpers are testable; no public surface promise.

## Decisions locked during brainstorming

| #   | Question                                         | Decision                                                                                                                                                                  | Reason                                                                                                                      |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | v1 surface                                       | Full dotenvx-equivalent: `-e`, repeatable `-f`, repeatable `--env`, `--overload`, `--dry-run`                                                                             | User chose full power; all features ship in v1                                                                              |
| 2   | Merge precedence                                 | dotenvx-style: `process.env` wins over files+inline by default; `--overload` flips it. Inline `--env` wins over files but loses to `process.env` (subject to overload)    | Matches dotenvx user expectations; safer default — running from a shell with `NODE_ENV=development` set won't get clobbered |
| 2a  | Both `.env.<stage>` and `.env.<stage>.gpg` exist | Encrypted wins                                                                                                                                                            | Encrypted is the source of truth; plain is a working copy                                                                   |
| 3   | `envx run` with no command after `--`            | Error (`INVALID_ARGS`)                                                                                                                                                    | `--dry-run` already covers inspection. Printing values to stdout would leak secrets into shell history, scrollback, CI logs |
| 4   | `-e <stage>` resolution scope                    | cwd-only, error if not found                                                                                                                                              | Avoids silent merging across monorepo packages; matches the smallest principle of least surprise                            |
| 5   | Variable expansion in env values                 | Full `${VAR}` and `${VAR:-default}` via `dotenv-expand`. Expansion runs against the file's own keys + `process.env` at parse time. Inline `--env` values are NOT expanded | Matches dotenv/dotenvx convention; the DATABASE_URL composition pattern is genuinely common                                 |
| 5a  | Command substitution `$(...)`                    | Skipped, possibly never                                                                                                                                                   | Security footgun; adds shell dependency                                                                                     |
| 6   | Implementation structure                         | Approach 1: thin command file, fat utility helpers                                                                                                                        | Matches existing `commands/` thin-orchestration over `utils/` pattern; keeps cross-cutting helpers reusable                 |

## File layout

### New files

- **`src/commands/run.ts`** — the command. Exports `createRunCommand()` and `executeRun(rawOptions, childArgs)`. ~150 lines. Owns: option parsing, source collection, override-rule application, dry-run output, top-level error handling. Calls into utility helpers for everything else.

- **`__tests__/core/run.test.ts`** — pure unit tests for parser glue, source resolution, merge logic, dry-run output. Mocks GPG and the spawn helper.

### Modified files

- **`src/utils/exec.ts`** — add two new methods on existing classes:
  - `ExecUtils.decryptFileToString(encryptedPath, passphrase): { success, content?, error? }` — sibling to `decryptFile`. Same GPG flags, same passphrase-via-stdin pattern, but `--decrypt` writes to stdout and we capture `result.stdout` from `shelljs.exec({ silent: true })`. Never touches disk.

  - `ExecUtils.spawnChildWithEnv(args, env, cwd): Promise<number>` — wraps Node's built-in `spawn` API (no new dependency). Uses `stdio: 'inherit'` and explicitly `shell: false` so `$VAR` references in argv are passed literally to the sub-process and never interpreted by a shell. Forwards SIGINT/SIGTERM/SIGHUP to the sub-process, cleans up listeners on exit, resolves with the sub-process exit code. Caller does `process.exit(code)`.

- **`src/utils/file.ts`** — add three methods on `FileUtils`:
  - `parseEnvContent(content): Record<string, string>` — wraps `dotenv.parse` + `dotenv-expand` into a single call. Expansion runs against the content's own keys plus `process.env` (dotenv-expand default). No command substitution.

  - `resolveStageFile(stage, cwd): Promise<{ path, encrypted } | null>` — looks for `.env.<stage>.gpg` then `.env.<stage>` in _cwd only_ (no recursion). Returns the encrypted variant if both exist.

  - `loadEnvSource(source, passphrase?): Promise<Record<string, string>>` — given a `{ path, encrypted }`, returns the parsed env. Hides the encrypted/plain branch from the command file.

- **`src/index.ts`** — register `createRunCommand()` alongside the others.

- **`src/schemas/index.ts`** — add `runSchema` and `validateRunOptions`. Schema validates option _shape_; cross-field rules (at least one source) enforced in `executeRun`.

- **`__tests__/integration/cli.test.ts`** — extend with `envx run` cases that shell out to real `dist/index.js` against fixture files in temp dirs.

- **`package.json`** — add `dotenv` and `dotenv-expand` as runtime dependencies. Both are tiny and de facto standards.

- **`README.md`** — add a `run` section under Commands with all examples from this spec, plus a security note explaining the no-disk-write guarantee.

- **`CLAUDE.md`** — add `run` to the list of commands in the Command Pattern section.

### No new utility classes

Run-specific orchestration lives in the command file. Cross-cutting helpers (decrypt-to-string, parse-env-content, spawn-sub-process) live in the utility classes that already own those concerns. No `RunUtils` class.

## CLI surface

### Command

```
envx run [options] -- <command> [args...]
```

### Options

| Flag                            | Repeatable | Default         | Description                                                                                                          |
| ------------------------------- | ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `-e, --environment <stage>`     | no         | —               | Stage to load. Resolves to `<cwd>/.env.<stage>.gpg` (preferred) or `<cwd>/.env.<stage>`. Errors if not found in cwd. |
| `-f, --env-file <path>`         | yes        | —               | Explicit env file. Encryption auto-detected by `.gpg` extension. Resolved against `--cwd`.                           |
| `--env <KEY=VAL>`               | yes        | —               | Inline override. Always wins over file values (subject to `--overload`).                                             |
| `-p, --passphrase <passphrase>` | no         | —               | GPG passphrase. Only used if any source is encrypted. Falls back to `.envrc` then interactive prompt.                |
| `-c, --cwd <path>`              | no         | `process.cwd()` | Working directory for file resolution AND for the spawned sub-process.                                               |
| `--overload`                    | no         | `false`         | Flip dotenvx-style precedence: files+inline win over `process.env`.                                                  |
| `--dry-run`                     | no         | `false`         | Print resolved key list (names only, no values) and the command that would run. Don't spawn anything.                |

### Validation rules (enforced in `executeRun`)

1. **At least one source required**: `-e`, `-f`, or `--env`. If none, error: `"At least one of --environment, --env-file, or --env is required"`.
2. **Command required**: at least one argument after `--`. If empty, error: `"No command specified. Usage: envx run [options] -- <command>"`.
3. **Inline format**: `--env KEY=VAL` requires `=`. Empty value (`--env FOO=`) is allowed and produces an empty string. No `=` → error: `"--env requires KEY=VALUE format, got: <input>"`.
4. **Passphrase resolution chain** (only if any source is encrypted): `--passphrase` flag > `.envrc` > interactive prompt. Same chain as encrypt/decrypt — no new resolution code.

### Commander wiring

- `.passThroughOptions()` and `.allowUnknownOption(true)` so flags meant for the sub-process (`npm run dev --watch`) don't get eaten as envx flags.
- `--` separator is the conventional and recommended invocation; Commander treats it as the argv terminator. Everything after lands in `command.args`.
- `-f` and `--env` use a `collect` accumulator to support repetition.

### Examples that must work in v1

```bash
# Stage from cwd
envx run -e production -- npm start

# Plain or encrypted file by path
envx run -f .env.local -- npm run dev
envx run -f ./secrets/.env.prod.gpg -p "$PASSPHRASE" -- node server.js

# Multiple files, later wins
envx run -f .env -f .env.local -- vitest

# Stage + inline override
envx run -e staging --env LOG_LEVEL=debug -- npm test

# Stage + extra file (file loaded after stage, so file wins between them)
envx run -e production -f .env.overrides -- npm start

# Force file values to clobber existing process.env
envx run -e production --overload -- npm start

# Dry run
envx run -e production --dry-run -- npm start
```

### Dry-run output format

```
Sources (in merge order, lowest → highest priority):
  1. .env.production.gpg (encrypted, 12 keys)
  2. .env.overrides (plain, 3 keys)
  3. inline --env (1 key)
process.env wins on conflict (no --overload)
Would inject 14 unique key(s):
  DATABASE_URL
  LOG_LEVEL
  ...
Would run: npm start
```

**Key names only — never values.** This is a hard rule, asserted in tests.

## Source resolution & merge pipeline

Six sequential stages.

### Stage 1: Collect raw sources from CLI flags

Build a `RawSource[]` list in conceptual order:

```ts
type RawSource =
  | { kind: 'stage'; stage: string }
  | { kind: 'file'; path: string }
  | { kind: 'inline'; key: string; value: string };
```

Order:

1. `-e <stage>` first (one entry max)
2. Each `-f <path>` in CLI order
3. Each `--env KEY=VAL` in CLI order

This ordering is what the merge walks through later. Inline `--env` always sits last in the file/inline group, so it always beats files.

### Stage 2: Resolve each `RawSource` to a `LoadedSource`

```ts
type LoadedSource = {
  origin: string; // for dry-run / error messages
  encrypted: boolean;
  values: Record<string, string>;
};
```

For each entry:

- **`{ kind: 'stage', stage }`** → `FileUtils.resolveStageFile(stage, cwd)`. If null, error: `"No env file found for stage '<stage>' in <cwd>. Looked for .env.<stage>.gpg and .env.<stage>"`. Otherwise convert to a file source with the resolved path.

- **`{ kind: 'file', path }`** → resolve relative to `--cwd`, check existence, mark encrypted by `.gpg` extension. If missing: `"Env file not found: <resolved-path>"`.

- **`{ kind: 'inline', key, value }`** → no I/O. `{ origin: '--env', encrypted: false, values: { [key]: value } }`.

### Stage 3: Resolve passphrase (only if needed)

After Stage 2, check if any `LoadedSource` has `encrypted: true`. If yes, resolve via `--passphrase` > `.envrc` > prompt. If no encrypted sources, skip entirely — no prompt, no `.envrc` read.

### Stage 4: Load file contents

For each file-backed `LoadedSource`:

- **Encrypted**: `ExecUtils.decryptFileToString(path, passphrase)` → `FileUtils.parseEnvContent(content)`. Errors propagate as `"Decryption failed for <path>: <gpg-error>"`. Hard error, no fallback to plain.
- **Plain**: `fs.readFile(path, 'utf-8')` → `FileUtils.parseEnvContent(content)`.

This is the only stage that touches the filesystem or shells out. Everything before is data shuffling; everything after is in-memory.

### Stage 5: Merge with dotenvx-style precedence

```ts
// Walk sources in order: each later source overrides earlier ones.
const fromSources: Record<string, string> = {};
for (const source of loadedSources) {
  Object.assign(fromSources, source.values);
}

// Apply overload rule against process.env.
const finalEnv: Record<string, string> = { ...process.env };
if (rawOptions.overload) {
  Object.assign(finalEnv, fromSources);
} else {
  for (const [k, v] of Object.entries(fromSources)) {
    if (!(k in finalEnv)) finalEnv[k] = v;
  }
}
```

Three important properties:

1. **Variable expansion happens inside `parseEnvContent`** before merging. `dotenv-expand` resolves `${VAR}` against the current source's keys + `process.env` at load time. Expansion does NOT see keys from later-loaded sources or other files. This matches dotenv/dotenvx behavior and is the only sane order.

2. **Inline `--env` values are not expanded.** Literal pass-through. Avoids shell-quoting confusion and matches "what the user typed is what they meant".

3. **Inline `--env` still loses to `process.env` when `--overload` is off.** Inline beats _files_ (it sits last in the source list), but without `--overload` the whole `fromSources` bundle — inline included — loses to any pre-existing `process.env` key. This is intentional: the dotenvx-style safety property is "the shell's environment is sacred unless the user explicitly opts in with `--overload`." Users who want inline overrides to _always_ win must pair them with `--overload`.

### Stage 6: Hand off to sub-process

Pass `finalEnv` and the user's argv to `ExecUtils.spawnChildWithEnv`. The exit code propagates back; the command file then `process.exit(code)`.

### Edge cases captured

- **Empty file**: a `.env.production.gpg` that decrypts to an empty string is not an error. Contributes zero keys.
- **Duplicate keys within a single file**: dotenv parser is last-write-wins inside the file. Accept as parser behavior.
- **Inline `--env FOO=`**: produces `FOO=""` in the sub-process env. Allowed.
- **Stage resolves to encrypted, decryption fails, plain `.env.<stage>` also exists**: hard error, do **not** fall back to plain. Reason: encrypted-wins for selection means encrypted is the source of truth; silent fallback would leak stale data and hide bugs.
- **`--passphrase` provided but no encrypted source**: silently ignored (warning in `--verbose`).

## Error handling, exit codes, signal forwarding

### Exit code policy

| Situation                                                         | Exit code                 | Source      |
| ----------------------------------------------------------------- | ------------------------- | ----------- |
| Success — sub-process exited 0                                    | `0`                       | sub-process |
| Sub-process exited non-zero                                       | sub-process code          | sub-process |
| Sub-process killed by signal                                      | re-raise signal on parent | sub-process |
| Validation error (missing source, no command, bad `--env` format) | `INVALID_ARGS` (2)        | envx        |
| File not found (`-f` path or `-e` resolution)                     | `FILE_ERROR` (3)          | envx        |
| GPG unavailable                                                   | `GPG_ERROR` (4)           | envx        |
| Decryption failed (wrong passphrase, corrupt file)                | `GPG_ERROR` (4)           | envx        |
| User cancelled passphrase prompt                                  | `USER_CANCELLED` (5)      | envx        |
| Anything else                                                     | `GENERAL_ERROR` (1)       | envx        |

The existing `ExitCode` enum in `src/types/index.ts` already has all of these. No new codes needed.

### Critical: sub-process exit code propagation must be exact

If `npm test` exits 1, `envx run -e test -- npm test` must exit 1. CI pipelines depend on this.

```ts
// In ExecUtils.spawnChildWithEnv
sub.on('exit', (code, signal) => {
  cleanup();
  if (signal) {
    // Re-raise the signal on the parent so the parent's exit
    // status reflects "killed by signal" not "exited normally".
    process.kill(process.pid, signal);
  } else {
    resolve(code ?? 0);
  }
});
```

The command file then does `process.exit(await ExecUtils.spawnChildWithEnv(...))`. **Do not** wrap the spawn in a try/catch that swallows the code into a generic error path — that's the bug class where `npm test` fails but CI sees exit 0.

### Signal forwarding

Forward to the sub-process and let it decide:

- `SIGINT` (Ctrl-C)
- `SIGTERM`
- `SIGHUP`

Pattern:

```ts
const forward = (sig: NodeJS.Signals) => () => {
  if (sub && !sub.killed) sub.kill(sig);
};
const sigint = forward('SIGINT');
const sigterm = forward('SIGTERM');
const sighup = forward('SIGHUP');
process.on('SIGINT', sigint);
process.on('SIGTERM', sigterm);
process.on('SIGHUP', sighup);

const cleanup = () => {
  process.off('SIGINT', sigint);
  process.off('SIGTERM', sigterm);
  process.off('SIGHUP', sighup);
};
```

dotenvx forwards a longer list (SIGQUIT, SIGUSR1/2, SIGABRT, SIGBUS, etc.). v1 ships with the three above; the others are rare and adding them later is non-breaking.

### Error message UX

Every envx-side error formats via the existing `CliUtils.error(...)`. User-actionable errors include the relevant path or value:

- `✗ No env file found for stage 'production' in /Users/foo/project. Looked for .env.production.gpg and .env.production`
- `✗ Decryption failed for ./.env.production.gpg. Check your passphrase or run 'envx config show' to verify configuration.`
- `✗ Env file not found: /Users/foo/project/.env.missing`
- `✗ --env requires KEY=VALUE format, got: FOO`
- `✗ At least one of --environment, --env-file, or --env is required`

### What we explicitly do NOT do on error

- **No partial runs.** If any source fails to load, abort _before_ spawning the sub-process. The sub-process is never invoked with a partially-loaded env.
- **No re-prompt loops on bad passphrase.** First failure → exit. Loop risks lockouts; annoying in CI where stdin isn't a TTY.
- **No stack traces in default output.** Stack traces only appear if `NODE_ENV=development`, matching the existing pattern in `src/index.ts`'s `uncaughtException` handler.
- **No leaking decrypted values into error messages.** If the parser chokes on malformed content, report the line number, not the line content.

### Quiet mode interaction

The existing global `--quiet` flag in `src/index.ts` overrides `console.log` to suppress non-error messages. For `envx run`, quiet mode suppresses envx's own informational output but **must not interfere with the sub-process stdio**, since we use `stdio: 'inherit'` — the sub-process writes directly to the terminal's stdout/stderr (not through Node's `console.log`), so this works automatically. A future maintainer should not "fix" this by piping the sub-process through Node.

### Security: shell mode is OFF

The spawn helper passes `shell: false` explicitly. This means user-supplied argv values are passed _literally_ to the underlying executable — no shell interpolation, no `$VAR` expansion in argv, no globbing, no command chaining via `&&` / `;`. This is intentional and a critical security property: a hostile env value or argv element cannot escape into a shell command. Users who genuinely need shell features must explicitly wrap their command (`envx run -e prod -- sh -c 'cmd1 && cmd2'`) — a clear, auditable opt-in.

## Testing strategy

Two layers, mirroring the existing `__tests__/core` (fast, mocked) and `__tests__/integration` (slow, real subprocess) split.

### Layer 1 — Core unit tests (`__tests__/core/run.test.ts`)

Pure logic, no GPG, no spawning. ~1s total.

| Test group                                    | What it covers                                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FileUtils.parseEnvContent`                   | dotenv parsing, `${VAR}` expansion against file's own keys, expansion against `process.env`, default values `${VAR:-foo}`, multiline, comments, empty values, quoted values                       |
| `FileUtils.resolveStageFile`                  | encrypted-wins when both exist, returns plain when only plain exists, returns null when neither, ignores files in subdirectories (cwd-only), case-sensitive stage matching                        |
| `FileUtils.loadEnvSource`                     | calls decrypt for `.gpg`, calls fs.readFile for plain, parses through `parseEnvContent` (mocked decrypt)                                                                                          |
| Source collection (pure function in `run.ts`) | order = `-e` then `-f` in argv order then `--env` in argv order; rejects `--env FOO` (no `=`); accepts `--env FOO=` (empty value)                                                                 |
| Merge logic (pure function in `run.ts`)       | files+inline merge in order, later wins; default keeps `process.env` on conflict; `--overload` flips it; inline always sits last in the file/inline group; expansion is per-source not post-merge |
| Validation rules                              | rejects no-source, rejects no-command, rejects bad `--env` format                                                                                                                                 |
| Dry-run output formatter                      | prints sources in merge order with origin + key counts; prints final unique key list; **never prints values** (explicit assertion that output contains no decrypted secret strings)               |

**Critical: merge logic and source collection must be pure functions** taking explicit inputs, not reading `process.env` directly. The command file injects `process.env` at the call site. This makes the merge fully unit-testable.

Concretely, `run.ts` should export these named pure functions (alongside `createRunCommand` and `executeRun`):

- `collectRawSources(rawOptions): RawSource[]` — deterministic, no I/O, no `process.env` access.
- `parseInlineEnv(kv: string): { key: string; value: string }` — throws on invalid format.
- `mergeEnv(loadedSources: LoadedSource[], parentEnv: Record<string, string>, overload: boolean): Record<string, string>` — the Stage 5 logic, parameterized.
- `formatDryRun(loadedSources: LoadedSource[], finalKeys: string[], overload: boolean, commandArgs: string[]): string` — deterministic string builder.

The unit tests call these directly. `executeRun` is the impure orchestrator that calls `process.exit` and is only exercised via integration tests.

**Mocking strategy**: mock `ExecUtils.decryptFileToString` and `ExecUtils.spawnChildWithEnv` at the module level for any test involving encryption or spawning. Real GPG is slow and adds CI flakiness; we trust GPG itself and only test our wrapper in integration.

### Layer 2 — Integration tests (`__tests__/integration/cli.test.ts`)

Extend the existing file. Real GPG, real spawning, real fixture directories. ~5–10 cases, ~10–20s total.

Each test creates a temp dir, drops in a real `.env.<stage>` file, runs `node dist/index.js encrypt -e <stage> -p <pass>` to produce a real `.gpg`, then exercises `envx run` against it. Reuses the existing `runCli` helper.

| Integration case                                                                          | What it proves                                                             |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `envx run -f plain.env -- node -e "console.log(process.env.FOO)"`                         | end-to-end plain file path, sub-process sees the var                       |
| `envx run -e production -- node -e "..."` (after creating + encrypting `.env.production`) | end-to-end stage resolution + GPG decrypt + spawn                          |
| `envx run -e production -p wrong -- node -e "..."`                                        | wrong passphrase → exit code 4, sub-process not invoked                    |
| `envx run -e missing -- node -e "..."`                                                    | missing stage → exit code 3, useful error message                          |
| `envx run -e production -- node -e "process.exit(42)"`                                    | **exit code propagation: parent exits 42** (the bug-class guard)           |
| `envx run -e production --env FOO=override -- node -e "..."`                              | inline override beats file                                                 |
| `envx run -e production -- node -e "..."` with `NODE_ENV=test` set in spawning shell      | dotenvx precedence: `process.env` wins over file                           |
| `envx run -e production --overload -- node -e "..."` with same setup                      | `--overload` flips it                                                      |
| `envx run -e production --dry-run -- node -e "..."`                                       | sub-process never invoked, output contains key names but no values, exit 0 |
| `envx run -e production -f extra.env -- node -e "..."`                                    | multi-source merge, later wins                                             |

### What we explicitly skip in v1 tests

- **Signal forwarding tests** (SIGINT/SIGTERM). Hard to write reliably across platforms; implementation is small and well-known. Add a regression test if a bug ever appears. Note this in `TESTING.md`.
- **Variable expansion edge cases** — covered by `dotenv-expand`'s own test suite.
- **Performance / large-file tests.** CLI launch time dominates anyway.
- **TTY/no-TTY behavior of inquirer prompts.** Not run-specific.

### Pre-test contract

Integration tests require `npm run build` first because they exec `dist/index.js`. Already true for the existing integration suite — no new constraint, but the implementation plan should call it out explicitly.

### Critical testing constraint

**`process.exit` inside `spawnChildWithEnv` cannot be intercepted by Jest.** Unit tests for the merge/source logic must use **pure functions**, not the full `executeRun`. Calling `executeRun` from a unit test will exit the Jest process. This is why Layer 1 tests pure functions and Layer 2 (integration) is the only layer that exercises the full command flow.

## Documentation deliverables

The implementation plan must include these doc updates as part of "done":

1. **`README.md`** — new `envx run` section with all examples from this spec, plus a security note explaining: (a) the no-disk-write guarantee, (b) the dotenvx-style precedence (`process.env` wins by default, `--overload` flips), (c) the encrypted-wins rule for dual-file stages, (d) `shell: false` and what it means for users who need shell features.
2. **`CLAUDE.md`** — add `run` to the Command Pattern bullet list under Architecture.
3. **`TESTING.md`** — note that signal-forwarding tests are intentionally skipped in v1, and that integration tests for `envx run` require `npm run build` first.

## Out of scope (deferred to follow-up specs)

- `envx export` / `envx printenv` — print resolved env to stdout. If users ask, ship as separate command with explicit secret-leak warnings.
- Walk-up cwd discovery (find nearest `.env.<stage>` walking up the tree like `.git`).
- Recursive monorepo merge with deterministic ordering.
- `--strict` mode (error on missing keys vs. warn).
- Convention presets (`--convention=nextjs`).
- Programmatic Node API surface.
- Per-file passphrase support (currently single passphrase across all encrypted sources).
- Re-prompt loops on bad passphrase.

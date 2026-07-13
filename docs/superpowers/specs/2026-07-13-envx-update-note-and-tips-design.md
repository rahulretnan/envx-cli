# envx update note + random tips (Design)

**Date:** 2026-07-13
**Status:** Approved
**Feature:** Two lightweight advisory outputs shown after a command finishes:
(1) a note when a newer `envx-cli` is available on npm, and (2) a random
single-line usage tip. Both share one suppression gate and never appear in
scripted/CI output.

## Motivation

Users don't notice new releases, and many never discover flags like
`encrypt --all`, `run`, or `files`. A dim advisory line after interactive
commands surfaces both without a dedicated command and without polluting
pipelines.

## Design decisions (agreed)

1. **Both outputs are ambient advisories** printed after a command completes,
   gated by a single `shouldShowHints()`.
2. **Update check is hand-rolled, zero new deps.** Node stdlib `https` fetch,
   `major.minor.patch` compare, cache dotfile. No `update-notifier`, no
   `semver`.
3. **Note reflects the previous check.** The current run prints from cache and
   never blocks; a stale cache triggers a detached background refresh for the
   next run.
4. **One random tip after each interactive command**, from a curated list.
5. **Single opt-out:** `ENVX_NO_HINTS=1` disables both. No per-feature flags.
6. **Skipped (YAGNI):** dedicated `envx tips` command, help-text tips, tip
   frequency throttling, separate opt-outs, auto-update.

## 1. Shared gate — `shouldShowHints`

`src/utils/hints.ts` exports:

```ts
shouldShowHints(opts: { quiet?: boolean }): boolean
```

Returns `false` (suppress) if ANY hold:

- `process.env.ENVX_NO_HINTS` is set (any non-empty value)
- `process.env.CI` is set (any non-empty value)
- `!process.stdout.isTTY`
- `opts.quiet === true`

Otherwise `true`. `opts` is the parsed global program options
(`program.opts()`), which already carries `quiet` from the existing
`-q, --quiet` flag.

## 2. Update check — `src/utils/update-check.ts`

### Cache

- Path: `path.join(os.homedir(), '.envx', 'update.json')`.
- Shape: `{ lastCheck: number; latest: string }` (epoch ms, semver string).
- `readCache(): { lastCheck: number; latest: string } | null` — returns `null`
  on missing file, unreadable file, or invalid JSON (never throws).
- `writeCache(latest: string): void` — ensures `~/.envx/` exists, writes
  `{ lastCheck: Date.now(), latest }`. Best-effort; swallow errors.

### Version compare

```ts
isNewer(latest: string, current: string): boolean
```

Parse each as up to three dot-separated integer parts (`major.minor.patch`),
ignoring any pre-release/build suffix after the first non-digit. Compare
numerically part by part; missing parts count as 0. Returns `true` only when
`latest` is strictly greater. Any unparseable input → `false` (safe default,
no note).

### Note text

```ts
getUpdateNote(current: string): string | null
```

Reads cache; if `cache && isNewer(cache.latest, current)`, returns the dim
one-liner:

```
ℹ Update available <current> → <latest> · run: npm i -g envx-cli
```

(styled via `chalk.dim`/`CliUtils`), else `null`.

### Background refresh

```ts
maybeRefreshInBackground(): void
```

- No-op unless `STALE`: `!cache || Date.now() - cache.lastCheck > 24h`.
- No-op unless running from the built binary: `__filename.endsWith('.js')`
  (skips ts-node/jest, so dev and tests never spawn a process or hit the
  network).
- Spawns a **detached, unref'd** child: `spawn(process.execPath, [__filename,
'--update-worker'], { detached: true, stdio: 'ignore' }).unref()`. Wrapped
  in try/catch; any failure is silent. Does not block or delay the parent.

### Worker entry

At module load, if `process.argv.includes('--update-worker')`, run the worker
and nothing else:

- `https.get('https://registry.npmjs.org/envx-cli/latest')` with a 3s timeout.
- On 200, parse JSON, read `.version`, call `writeCache(version)`.
- On any error/timeout/non-200, exit silently.
- Always `process.exit(0)` when done (never hang).

The worker guard must run before/independently of the Commander program so the
detached invocation does no CLI work.

## 3. Tips — in `src/utils/hints.ts`

```ts
const TIPS: string[]           // curated single-line recommendations
pickTip(): string              // uniformly random element
```

`TIPS` covers the key surface (indicative, finalized in implementation):

- `encrypt --all` encrypts every stage in one go
- `decrypt --all` after cloning restores every stage + registered file
- `run -e prod -- <cmd>` injects secrets with no plaintext on disk
- `files add <path>` encrypts certs & keystores alongside your envs
- `--dry-run` previews encrypt/decrypt without writing
- `config show` prints the resolved `.envxrc`
- `list` / `status` show what's encrypted and what's missing
- `copy -e <stage>` writes a stage file to plain `.env`
- `create -e <stage>` scaffolds a new environment file
- `interactive` sets up `.envrc` passphrases

Each tip renders as `chalk.dim('💡 ' + tip)` (styling not asserted in tests).

## 4. Orchestrator — `printAdvisories`

`src/utils/hints.ts` exports:

```ts
printAdvisories(opts: { quiet?: boolean }, current: string): void
```

1. If `!shouldShowHints(opts)`, return immediately (nothing printed, no
   refresh).
2. `const note = getUpdateNote(current)`; if non-null, print it.
3. Print `pickTip()`.
4. Call `maybeRefreshInBackground()`.
5. Whole body wrapped so it can never throw into the caller.

Update note prints above the tip when both appear.

## 5. Wiring — `src/index.ts`

In `main()`, after `await program.parseAsync(process.argv)` completes
successfully, call:

```ts
printAdvisories(program.opts(), packageJson.version);
```

- Only reached on normal completion. Commands that `process.exit()` on error
  bypass it (no advisories after failures) — intended.
- Bare `envx` calls `program.help()` (which exits) → no advisories on the
  help screen — acceptable.
- `program` must be in scope at that point; if `createProgram()` is local to
  `main`, keep the reference to pass its `opts()`.

## 6. Testing

Hermetic — no real network, no real spawn, no real home-dir writes.

Core (`__tests__/core/update-check.test.ts`):

- `isNewer`: `1.6.0>1.5.0` true; equal false; `1.5.1>1.5.0` true;
  `2.0.0>1.9.9` true; missing parts (`1.6>1.5.9`) handled; unparseable →
  false.
- `readCache`/`writeCache` round-trip in a temp `HOME` (or injected path);
  `readCache` returns `null` on missing/corrupt file.
- `getUpdateNote` returns the string when cache is newer, `null` otherwise.

Core (`__tests__/core/hints.test.ts`):

- `shouldShowHints` matrix: suppressed by `ENVX_NO_HINTS`, `CI`, non-TTY,
  `quiet:true`; allowed when all clear and TTY.
- `pickTip` returns a member of `TIPS`.
- `printAdvisories` is silent (no stdout) when the gate is closed; prints when
  open (assert a tip line appears; do not assert exact styling).

To keep tests hermetic, `readCache`/`writeCache` resolve the cache path via a
single internal helper that reads `process.env.HOME`/`os.homedir()`, so tests
point `HOME` at a temp dir. `maybeRefreshInBackground` is not exercised in
tests (its `.js`-only guard makes it a no-op under jest).

## 7. Documentation

- **README.md** — short "Update notice & tips" note mentioning the advisory
  lines and the `ENVX_NO_HINTS=1` opt-out.
- **CLAUDE.md** — one line under the CLI/output notes documenting
  `printAdvisories`, the gate, and `ENVX_NO_HINTS`.
- **docs/project/changes-log.md** — dated entry.

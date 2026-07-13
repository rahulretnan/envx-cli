# envx Update Note + Random Tips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After each interactive command, optionally show a dim "update available" note and one random usage tip — both suppressed in scripts/CI, using zero new dependencies.

**Architecture:** A pure/side-effect-light `update-check.ts` (version compare, cache read/write, note text, detached background refresh) and a `hints.ts` (suppression gate, tips list, `printAdvisories` orchestrator). A single `printAdvisories(program.opts(), version)` call at the end of `main()` in `src/index.ts`.

**Tech Stack:** TypeScript (strict), Node stdlib (`https`, `child_process`, `os`, `fs`), chalk, Jest/ts-jest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-13-envx-update-note-and-tips-design.md`

## Global Constraints

- TypeScript strict mode; single quotes, semicolons, trailing commas (es5), 2-space indent, 80-char lines (Prettier enforced).
- Zero new dependencies — Node stdlib only for the update check (no `update-notifier`, no `semver`).
- Both outputs are suppressed when ANY of: `ENVX_NO_HINTS` set, `CI` set, `!process.stdout.isTTY`, `opts.quiet === true`.
- Every advisory path is best-effort: it must never throw into, block, or delay the CLI.
- Node engine floor is `>=14.0.0` — no APIs newer than that.
- Cache file: `path.join(os.homedir(), '.envx', 'update.json')`, shape `{ lastCheck: number; latest: string }`.
- Update note text: `ℹ Update available <current> → <latest> · run: npm i -g envx-cli` (dim).
- Tips render as `chalk.dim('💡 ' + tip)`; styling is not asserted in tests.

---

### Task 1: `update-check.ts` — version compare, cache, note, background refresh

**Files:**

- Create: `src/utils/update-check.ts`
- Test: `__tests__/core/update-check.test.ts`

**Interfaces:**

- Produces (used by Task 2):
  - `isNewer(latest: string, current: string): boolean`
  - `readCache(): { lastCheck: number; latest: string } | null`
  - `writeCache(latest: string): void`
  - `getUpdateNote(current: string): string | null`
  - `maybeRefreshInBackground(): void`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/core/update-check.test.ts`:

```typescript
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  getUpdateNote,
  isNewer,
  readCache,
  writeCache,
} from '../../src/utils/update-check';

describe('isNewer', () => {
  it.each([
    ['1.6.0', '1.5.0', true],
    ['1.5.0', '1.5.0', false],
    ['1.5.0', '1.6.0', false],
    ['1.5.1', '1.5.0', true],
    ['2.0.0', '1.9.9', true],
    ['1.6', '1.5.9', true],
    ['1.6.0-beta.1', '1.5.0', true],
    ['garbage', '1.5.0', false],
    ['1.5.0', 'garbage', false],
  ])('isNewer(%s, %s) === %s', (latest, current, expected) => {
    expect(isNewer(latest, current)).toBe(expected);
  });
});

describe('cache', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-upd-'));
    jest.spyOn(os, 'homedir').mockReturnValue(tmp);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(tmp);
  });

  it('round-trips through writeCache/readCache', () => {
    writeCache('1.6.0');
    const cache = readCache();
    expect(cache?.latest).toBe('1.6.0');
    expect(typeof cache?.lastCheck).toBe('number');
  });

  it('readCache returns null when the file is missing', () => {
    expect(readCache()).toBeNull();
  });

  it('readCache returns null on corrupt JSON', async () => {
    await fs.ensureDir(path.join(tmp, '.envx'));
    await fs.writeFile(path.join(tmp, '.envx', 'update.json'), 'not json');
    expect(readCache()).toBeNull();
  });

  it('getUpdateNote returns a note only when cache is newer', () => {
    writeCache('1.6.0');
    expect(getUpdateNote('1.5.0')).toContain('1.5.0');
    expect(getUpdateNote('1.5.0')).toContain('1.6.0');
    expect(getUpdateNote('1.6.0')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/core/update-check.test.ts`
Expected: FAIL — `Cannot find module '../../src/utils/update-check'`

- [ ] **Step 3: Implement `src/utils/update-check.ts`**

```typescript
import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import https from 'https';
import os from 'os';
import path from 'path';

interface UpdateCache {
  lastCheck: number;
  latest: string;
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const REGISTRY_URL = 'https://registry.npmjs.org/envx-cli/latest';
const REQUEST_TIMEOUT_MS = 3000;

function getCachePath(): string {
  return path.join(os.homedir(), '.envx', 'update.json');
}

// Parse up to three dotted integer parts; parseInt stops at the first
// non-digit, so "6-beta" -> 6. Missing parts count as 0. NaN -> invalid.
function parseVersion(v: string): [number, number, number] | null {
  const parts = String(v)
    .split('.')
    .slice(0, 3)
    .map(p => parseInt(p, 10));
  while (parts.length < 3) parts.push(0);
  if (parts.some(n => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

export function readCache(): UpdateCache | null {
  try {
    const raw = fs.readFileSync(getCachePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.latest === 'string' &&
      typeof parsed.lastCheck === 'number'
    ) {
      return parsed as UpdateCache;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCache(latest: string): void {
  try {
    const file = getCachePath();
    fs.ensureDirSync(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify({ lastCheck: Date.now(), latest }));
  } catch {
    // best-effort; a failed cache write just means we re-check next time
  }
}

export function getUpdateNote(current: string): string | null {
  const cache = readCache();
  if (cache && isNewer(cache.latest, current)) {
    return chalk.dim(
      `ℹ Update available ${current} → ${cache.latest} · run: npm i -g envx-cli`
    );
  }
  return null;
}

// Fire-and-forget refresh. Never blocks or delays the parent process.
export function maybeRefreshInBackground(): void {
  try {
    const cache = readCache();
    const stale = !cache || Date.now() - cache.lastCheck > CHECK_INTERVAL_MS;
    if (!stale) return;
    // Only meaningful for the built binary; under ts-node/jest __filename
    // is a .ts file and re-spawning node on it would fail, so skip.
    if (!__filename.endsWith('.js')) return;

    const child = spawn(process.execPath, [__filename, '--update-worker'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // never let a background refresh affect the CLI
  }
}

// Worker: fetch latest version and update the cache, then exit.
function runWorker(): void {
  const req = https.get(REGISTRY_URL, res => {
    if (res.statusCode !== 200) {
      res.resume();
      process.exit(0);
    }
    let body = '';
    res.setEncoding('utf-8');
    res.on('data', chunk => (body += chunk));
    res.on('end', () => {
      try {
        const version = JSON.parse(body).version;
        if (typeof version === 'string') writeCache(version);
      } catch {
        // ignore parse errors
      }
      process.exit(0);
    });
  });
  req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy());
  req.on('error', () => process.exit(0));
}

if (require.main === module && process.argv.includes('--update-worker')) {
  runWorker();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/core/update-check.test.ts`
Expected: PASS

- [ ] **Step 5: Confirm strict compilation**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/utils/update-check.ts __tests__/core/update-check.test.ts
git commit -m "feat(hints): update-check cache, version compare, background refresh"
```

---

### Task 2: `hints.ts` — gate, tips, orchestrator

**Files:**

- Create: `src/utils/hints.ts`
- Test: `__tests__/core/hints.test.ts`

**Interfaces:**

- Consumes: `getUpdateNote(current)`, `maybeRefreshInBackground()` from `src/utils/update-check.ts` (Task 1).
- Produces (used by Task 3):
  - `shouldShowHints(opts: { quiet?: boolean }): boolean`
  - `TIPS: string[]`
  - `pickTip(): string`
  - `printAdvisories(opts: { quiet?: boolean }, current: string): void`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/core/hints.test.ts`:

```typescript
import {
  pickTip,
  printAdvisories,
  shouldShowHints,
  TIPS,
} from '../../src/utils/hints';

describe('shouldShowHints', () => {
  const realTTY = process.stdout.isTTY;
  const realCI = process.env.CI;
  const realNoHints = process.env.ENVX_NO_HINTS;

  beforeEach(() => {
    (process.stdout as { isTTY?: boolean }).isTTY = true;
    delete process.env.CI;
    delete process.env.ENVX_NO_HINTS;
  });

  afterEach(() => {
    (process.stdout as { isTTY?: boolean }).isTTY = realTTY;
    if (realCI === undefined) delete process.env.CI;
    else process.env.CI = realCI;
    if (realNoHints === undefined) delete process.env.ENVX_NO_HINTS;
    else process.env.ENVX_NO_HINTS = realNoHints;
  });

  it('allows hints when TTY and nothing suppresses', () => {
    expect(shouldShowHints({})).toBe(true);
  });

  it('suppresses when quiet', () => {
    expect(shouldShowHints({ quiet: true })).toBe(false);
  });

  it('suppresses when ENVX_NO_HINTS is set', () => {
    process.env.ENVX_NO_HINTS = '1';
    expect(shouldShowHints({})).toBe(false);
  });

  it('suppresses in CI', () => {
    process.env.CI = 'true';
    expect(shouldShowHints({})).toBe(false);
  });

  it('suppresses when not a TTY', () => {
    (process.stdout as { isTTY?: boolean }).isTTY = false;
    expect(shouldShowHints({})).toBe(false);
  });
});

describe('pickTip', () => {
  it('returns a member of TIPS', () => {
    expect(TIPS).toContain(pickTip());
  });
});

describe('printAdvisories', () => {
  let logs: string[];
  let spy: jest.SpyInstance;

  beforeEach(() => {
    logs = [];
    spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
  });

  afterEach(() => {
    spy.mockRestore();
    (process.stdout as { isTTY?: boolean }).isTTY = true;
  });

  it('prints nothing when the gate is closed', () => {
    (process.stdout as { isTTY?: boolean }).isTTY = false;
    printAdvisories({}, '1.5.0');
    expect(logs).toHaveLength(0);
  });

  it('prints a tip when the gate is open', () => {
    (process.stdout as { isTTY?: boolean }).isTTY = true;
    delete process.env.CI;
    delete process.env.ENVX_NO_HINTS;
    printAdvisories({}, '1.5.0');
    expect(logs.join('\n')).toContain('💡');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/core/hints.test.ts`
Expected: FAIL — `Cannot find module '../../src/utils/hints'`

- [ ] **Step 3: Implement `src/utils/hints.ts`**

```typescript
import chalk from 'chalk';
import { getUpdateNote, maybeRefreshInBackground } from './update-check';

export const TIPS: string[] = [
  'encrypt --all encrypts every stage in one go',
  'decrypt --all after cloning restores every stage and registered file',
  'run -e prod -- <cmd> injects secrets with no plaintext on disk',
  'files add <path> encrypts certs and keystores alongside your envs',
  '--dry-run previews encrypt/decrypt without writing anything',
  'config show prints the resolved .envxrc for this project',
  'list and status show what is encrypted and what is missing',
  'copy -e <stage> writes a stage file to a plain .env',
  'create -e <stage> scaffolds a new environment file',
  'interactive sets up your .envrc passphrases',
  'skill add installs an agent skill so AI tools use envx correctly',
];

export function shouldShowHints(opts: { quiet?: boolean }): boolean {
  if (process.env.ENVX_NO_HINTS) return false;
  if (process.env.CI) return false;
  if (!process.stdout.isTTY) return false;
  if (opts.quiet) return false;
  return true;
}

export function pickTip(): string {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

export function printAdvisories(
  opts: { quiet?: boolean },
  current: string
): void {
  try {
    if (!shouldShowHints(opts)) return;

    const note = getUpdateNote(current);
    if (note) console.log(note);

    console.log(chalk.dim(`💡 ${pickTip()}`));

    maybeRefreshInBackground();
  } catch {
    // advisories must never affect the CLI
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/core/hints.test.ts`
Expected: PASS

- [ ] **Step 5: Confirm strict compilation**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/utils/hints.ts __tests__/core/hints.test.ts
git commit -m "feat(hints): suppression gate, tips list, printAdvisories orchestrator"
```

---

### Task 3: Wire into `main()`, integration guard, docs, verification

**Files:**

- Modify: `src/index.ts` (imports near line 20; `main()` after `await program.parseAsync(process.argv)` ~line 538)
- Modify: `__tests__/integration/cli.test.ts` (add a describe block using the existing `runCli`/`testDir`)
- Modify: `README.md`, `CLAUDE.md`, `docs/project/changes-log.md`

**Interfaces:**

- Consumes: `printAdvisories(opts, current)` from `src/utils/hints.ts` (Task 2); the existing `packageJson.version` and the local `program` in `main()`.

- [ ] **Step 1: Add the integration test (guards the "no noise in scripts" contract)**

Integration tests exec `dist/index.js` with piped stdout (not a TTY), so the gate is closed and advisories must NOT appear. Add to `__tests__/integration/cli.test.ts`, inside the outer `describe('CLI Integration Tests', ...)` alongside the other describes:

```typescript
describe('Advisory output', () => {
  it('does not print tips or update notes in non-TTY output', () => {
    const result = runCli('list');

    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain('💡');
    expect(result.stdout).not.toContain('Update available');
  });
});
```

- [ ] **Step 2: Build and run the integration test to verify it fails**

Run: `npm run build && npx jest __tests__/integration/cli.test.ts -t "Advisory output"`
Expected: PASS actually — the wiring isn't in yet, so no advisories are printed and the assertion (that they're absent) already holds. This test is a regression guard, not a red-first test: it must stay green after Step 3 wires advisories in. Record that it passes now.

- [ ] **Step 3: Wire `printAdvisories` into `main()`**

In `src/index.ts`, add to the imports (after the existing util imports around line 20):

```typescript
import { printAdvisories } from './utils/hints';
```

In `main()`, change:

```typescript
    await program.parseAsync(process.argv);
  } catch (error) {
```

to:

```typescript
    await program.parseAsync(process.argv);

    printAdvisories(program.opts(), packageJson.version);
  } catch (error) {
```

- [ ] **Step 4: Rebuild and re-run the integration test**

Run: `npm run build && npx jest __tests__/integration/cli.test.ts -t "Advisory output"`
Expected: PASS — advisories are gated off under piped stdout, so `list` output still contains neither `💡` nor `Update available`.

- [ ] **Step 5: Manually confirm the positive path in a TTY**

Run: `node dist/index.js list`
Expected: a dim `💡 ...` tip line appears after the list output (an interactive terminal is a TTY). No update note unless `~/.envx/update.json` already has a newer version cached. Confirm `ENVX_NO_HINTS=1 node dist/index.js list` shows no tip.

- [ ] **Step 6: Update README**

Add a short subsection (place near the end of the Commands or Configuration area, matching existing heading depth):

````markdown
### Update notice & tips

After interactive commands, envx may print a dim one-line "update available"
note (when a newer `envx-cli` is on npm) and a random usage tip. Both are
suppressed automatically in non-interactive output (pipes, CI, `--quiet`).
Disable them entirely with:

```bash
export ENVX_NO_HINTS=1
```
````

- [ ] **Step 7: Update CLAUDE.md**

Add one bullet under the Code Style / CLI notes area:

```markdown
- After a command completes, `main()` calls `printAdvisories(program.opts(), version)` (`src/utils/hints.ts`) — a dim update note (via `src/utils/update-check.ts`, cache at `~/.envx/update.json`, detached background refresh) and one random tip. Suppressed when `!stdout.isTTY`, `CI`, `--quiet`, or `ENVX_NO_HINTS` is set. No new deps; never throws/blocks.
```

- [ ] **Step 8: Update changes-log**

Append a `2026-07-13` entry to `docs/project/changes-log.md` in that file's existing format, covering: new `src/utils/update-check.ts` and `src/utils/hints.ts`, the `printAdvisories` hook in `main()`, and the `ENVX_NO_HINTS` opt-out.

- [ ] **Step 9: Full verification**

Run: `npm run build && npm test && npm run lint && npm run format:check`
Expected: all pass (pre-existing `@typescript-eslint/no-explicit-any` warnings in `commands/` acceptable; zero errors).

- [ ] **Step 10: Commit**

```bash
git add src/index.ts __tests__/integration/cli.test.ts README.md CLAUDE.md docs/project/changes-log.md
git commit -m "feat(hints): show update note + tip after commands; docs and opt-out"
```

# Monorepo `.envrc` / `.envxrc` Discovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make envx discover `.envrc` (passphrases) and `.envxrc` (project config) by walking upward from `cwd` so commands run from a monorepo subdirectory (e.g., `packages/db/`) find the config at the repo root instead of falling through to an interactive passphrase prompt.

**Architecture:** Introduce one new helper on `FileUtils` — `findProjectRoot(cwd)` — that walks upward and returns the first ancestor containing any of `.envrc`, `.envxrc`, or `.git`. Build two thin wrappers (`findEnvrcUpward`, `findEnvxrcUpward`) plus a convenience reader (`readEnvrcNearest`) on top of it. Rewire the six command/utility files that currently call `readEnvrc(cwd)` / `readEnvxrc(cwd)` to use the walking variants. Drop `.envxrc` from the `.gitignore` defaults (it's project config, not a secret). Stage file discovery (`resolveStageFile`) is unchanged — still cwd-only, per the v1 `run` spec decision.

**Tech Stack:** TypeScript (strict), Node.js `fs-extra`, Jest + ts-jest, Commander.js.

**Reference Spec:** `docs/superpowers/specs/2026-04-08-envx-monorepo-config-discovery-design.md`

---

## File Structure

**Modified files:**

| File                                | What changes                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/file.ts`                 | Add `findProjectRoot`, `findEnvrcUpward`, `findEnvxrcUpward`, `readEnvrcNearest`. Rewire `getIgnorePatterns`, `getExcludeDirs`, `mergeEnvxrc`. Drop `.envxrc` from `updateGitignore`. |
| `src/commands/run.ts`               | Replace `readEnvrc(cwd)` with `readEnvrcNearest(cwd)`.                                                                                                                                |
| `src/commands/encrypt.ts`           | Same.                                                                                                                                                                                 |
| `src/commands/decrypt.ts`           | Same.                                                                                                                                                                                 |
| `src/commands/copy.ts`              | Same. Collapse the now-redundant `rootCwd` variable.                                                                                                                                  |
| `src/commands/interactive.ts`       | Two call sites — both switch to `readEnvrcNearest`.                                                                                                                                   |
| `src/utils/interactive.ts`          | One call site — switch to `readEnvrcNearest`.                                                                                                                                         |
| `src/commands/config.ts`            | `show`/`ignore list`/`exclude list` read via `findEnvxrcUpward` + `readEnvxrc`, and print the resolved path when not in cwd.                                                          |
| `__tests__/core/file.test.ts`       | Add unit tests for new helpers and updated `mergeEnvxrc`/`updateGitignore` semantics.                                                                                                 |
| `__tests__/integration/cli.test.ts` | Add a monorepo fixture that reproduces the bug and asserts the fix.                                                                                                                   |
| `CLAUDE.md`                         | Document the upward walk in the "Configuration Files" section.                                                                                                                        |
| `README.md`                         | Document the upward walk in the "Configuration Files" section.                                                                                                                        |

**New files:** None.

---

## Task 1: `findProjectRoot` helper with internal entry-exists probe

**Files:**

- Modify: `src/utils/file.ts` (add new method inside `FileUtils` class near the existing `fileExists` method around line 218)
- Test: `__tests__/core/file.test.ts` (add new `describe('findProjectRoot')` block inside the top-level `describe('FileUtils Core Operations')`)

**Rationale:** Every other walking helper delegates to this one. It must correctly handle the three marker types, permission errors, and filesystem-root termination on both POSIX and Windows.

**Important implementation note:** `FileUtils.fileExists` uses `stat.isFile()`, which rejects directories. A `.git` entry is usually a directory (normal repo) and sometimes a file (submodule). We need a separate probe that returns `true` for either. Keep it private to `findProjectRoot` (a local `async` function or a private static) — do not export a second public existence helper.

- [ ] **Step 1: Write the failing tests for `findProjectRoot`**

Add this block to `__tests__/core/file.test.ts` (inside the top-level `describe('FileUtils Core Operations')`, after the existing describe blocks):

```ts
describe('findProjectRoot', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-findroot-'));
    // Resolve symlinks (macOS /var → /private/var) so path assertions are
    // comparing apples to apples regardless of platform.
    tempDir = await fs.realpath(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('returns cwd itself when cwd contains .envrc', async () => {
    await fs.writeFile(path.join(tempDir, '.envrc'), 'export FOO=bar');
    const result = await FileUtils.findProjectRoot(tempDir);
    expect(result).toBe(tempDir);
  });

  it('returns cwd itself when cwd contains .envxrc', async () => {
    await fs.writeJson(path.join(tempDir, '.envxrc'), {});
    const result = await FileUtils.findProjectRoot(tempDir);
    expect(result).toBe(tempDir);
  });

  it('returns cwd itself when cwd contains a .git directory', async () => {
    await fs.ensureDir(path.join(tempDir, '.git'));
    const result = await FileUtils.findProjectRoot(tempDir);
    expect(result).toBe(tempDir);
  });

  it('returns cwd itself when cwd contains a .git file (submodule)', async () => {
    await fs.writeFile(
      path.join(tempDir, '.git'),
      'gitdir: ../.git/modules/sub\n'
    );
    const result = await FileUtils.findProjectRoot(tempDir);
    expect(result).toBe(tempDir);
  });

  it('returns nearest ancestor when cwd has no markers', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeFile(path.join(tempDir, '.envrc'), 'export FOO=bar');

    const result = await FileUtils.findProjectRoot(sub);
    expect(result).toBe(tempDir);
  });

  it('prefers the nearest ancestor when multiple contain markers', async () => {
    const mid = path.join(tempDir, 'repo');
    const sub = path.join(mid, 'packages', 'db');
    await fs.ensureDir(sub);
    // Outer marker: tempDir has .envrc
    await fs.writeFile(path.join(tempDir, '.envrc'), 'export OUTER=1');
    // Inner marker: mid has .git
    await fs.ensureDir(path.join(mid, '.git'));

    const result = await FileUtils.findProjectRoot(sub);
    expect(result).toBe(mid);
  });

  it('returns null when no marker exists up to the filesystem root', async () => {
    const sub = path.join(tempDir, 'deep', 'nested', 'path');
    await fs.ensureDir(sub);
    // No markers anywhere inside tempDir, and tempDir itself is in /tmp which
    // has no markers either. (This assumes /tmp is not a git repo, which is
    // standard on macOS and Linux CI.)
    const result = await FileUtils.findProjectRoot(sub);
    expect(result).toBeNull();
  });

  it('handles relative paths by resolving them first', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeFile(path.join(tempDir, '.envrc'), 'export FOO=bar');

    const originalCwd = process.cwd();
    try {
      process.chdir(sub);
      const result = await FileUtils.findProjectRoot('.');
      expect(result).toBe(tempDir);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "findProjectRoot"
```

Expected: all tests fail with `TypeError: FileUtils.findProjectRoot is not a function`.

- [ ] **Step 3: Implement `findProjectRoot`**

In `src/utils/file.ts`, add this method inside the `FileUtils` class. Place it after the existing `fileExists` method (currently around line 225). The internal probe function is defined at module scope so it stays private.

At the top of the file, keep existing imports. After the class, add nothing — helper lives inside the class as a private static.

Add the helper method (inside the `FileUtils` class):

```ts
  /**
   * Returns true if `fs.stat` succeeds on the given path, regardless of
   * entry type (file OR directory). Used by findProjectRoot to detect
   * `.git` which may be a directory (normal repo) or a file (submodule).
   *
   * Distinct from fileExists(), which rejects directories.
   */
  private static async entryExists(entryPath: string): Promise<boolean> {
    try {
      await fs.stat(entryPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Walk upward from `cwd` returning the first ancestor (or `cwd` itself)
   * that contains any of `.envrc`, `.envxrc`, or `.git`. Returns `null` if
   * the walk reaches the filesystem root without finding a marker.
   *
   * Used to determine the "project root" for config discovery in monorepos.
   * Not aware of symlinks — the input is resolved once via path.resolve and
   * then walked as-given (no fs.realpath on each step).
   */
  static async findProjectRoot(cwd: string): Promise<string | null> {
    const markers = ['.envrc', '.envxrc', '.git'];
    let current = path.resolve(cwd);

    while (true) {
      for (const marker of markers) {
        if (await this.entryExists(path.join(current, marker))) {
          return current;
        }
      }

      const parent = path.dirname(current);
      if (parent === current) {
        // Hit the filesystem root (POSIX '/' or Windows 'C:\\').
        return null;
      }
      current = parent;
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "findProjectRoot"
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/file.ts __tests__/core/file.test.ts
git commit -m "$(cat <<'EOF'
feat(file): add findProjectRoot helper

Walks upward from cwd and returns the first ancestor containing any of
.envrc, .envxrc, or .git. Uses a private entry-exists probe that accepts
both files and directories (git submodules store .git as a file).

Foundation for .envrc and .envxrc upward discovery in monorepo
subdirectories.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `findEnvrcUpward` and `findEnvxrcUpward` thin wrappers

**Files:**

- Modify: `src/utils/file.ts` (add two methods next to `findProjectRoot`)
- Test: `__tests__/core/file.test.ts` (two new `describe` blocks)

**Rationale:** Callers want "where should I read `.envrc` from?", not "where's the project root?". These wrappers encapsulate the delegation: project root + file presence check. If the project root exists but doesn't contain the specific file, return `null` — callers fall back to their no-config path.

- [ ] **Step 1: Write failing tests for `findEnvrcUpward`**

Add this block to `__tests__/core/file.test.ts` next to the `findProjectRoot` tests:

```ts
describe('findEnvrcUpward', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-findenvrc-'));
    tempDir = await fs.realpath(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('returns directory containing .envrc when walking from a subdirectory', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeFile(path.join(tempDir, '.envrc'), 'export DEV_SECRET="s"');

    const result = await FileUtils.findEnvrcUpward(sub);
    expect(result).toBe(tempDir);
  });

  it('returns cwd when .envrc is in cwd', async () => {
    await fs.writeFile(path.join(tempDir, '.envrc'), 'export DEV_SECRET="s"');
    const result = await FileUtils.findEnvrcUpward(tempDir);
    expect(result).toBe(tempDir);
  });

  it('returns null when project root has .git but no .envrc', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.ensureDir(path.join(tempDir, '.git'));
    // No .envrc anywhere.

    const result = await FileUtils.findEnvrcUpward(sub);
    expect(result).toBeNull();
  });

  it('returns null when project root has .envxrc but no .envrc', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeJson(path.join(tempDir, '.envxrc'), {});

    const result = await FileUtils.findEnvrcUpward(sub);
    expect(result).toBeNull();
  });

  it('returns null when no project root is found', async () => {
    const sub = path.join(tempDir, 'nothing', 'here');
    await fs.ensureDir(sub);
    const result = await FileUtils.findEnvrcUpward(sub);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Write failing tests for `findEnvxrcUpward`**

Add this block next to the `findEnvrcUpward` tests:

```ts
describe('findEnvxrcUpward', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-findenvxrc-'));
    tempDir = await fs.realpath(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('returns directory containing .envxrc when walking from a subdirectory', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeJson(path.join(tempDir, '.envxrc'), {
      ignore: ['demo'],
    });

    const result = await FileUtils.findEnvxrcUpward(sub);
    expect(result).toBe(tempDir);
  });

  it('returns null when project root has .envrc but no .envxrc', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeFile(path.join(tempDir, '.envrc'), 'export DEV_SECRET="s"');

    const result = await FileUtils.findEnvxrcUpward(sub);
    expect(result).toBeNull();
  });

  it('returns null when no project root is found', async () => {
    const sub = path.join(tempDir, 'nothing', 'here');
    await fs.ensureDir(sub);
    const result = await FileUtils.findEnvxrcUpward(sub);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "findEnvrcUpward|findEnvxrcUpward"
```

Expected: all tests fail with `TypeError: FileUtils.findEnvrcUpward is not a function` (and similarly for `findEnvxrcUpward`).

- [ ] **Step 4: Implement both wrappers**

In `src/utils/file.ts`, add these two methods inside the `FileUtils` class, immediately after `findProjectRoot`:

```ts
  /**
   * Walk upward from `cwd` and return the directory containing the nearest
   * `.envrc`. Returns `null` if the project root (as determined by
   * findProjectRoot) does not contain `.envrc`, or if no project root is
   * found at all.
   *
   * Callers should fall back to their existing no-config path when this
   * returns null (e.g., prompt for passphrase interactively).
   */
  static async findEnvrcUpward(cwd: string): Promise<string | null> {
    const root = await this.findProjectRoot(cwd);
    if (root === null) {
      return null;
    }
    const envrcExists = await this.fileExists(path.join(root, '.envrc'));
    return envrcExists ? root : null;
  }

  /**
   * Walk upward from `cwd` and return the directory containing the nearest
   * `.envxrc`. Returns `null` if the project root does not contain
   * `.envxrc`, or if no project root is found at all.
   *
   * Callers should fall back to defaults when this returns null.
   */
  static async findEnvxrcUpward(cwd: string): Promise<string | null> {
    const root = await this.findProjectRoot(cwd);
    if (root === null) {
      return null;
    }
    const envxrcExists = await this.fileExists(path.join(root, '.envxrc'));
    return envxrcExists ? root : null;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "findEnvrcUpward|findEnvxrcUpward"
```

Expected: all 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/file.ts __tests__/core/file.test.ts
git commit -m "$(cat <<'EOF'
feat(file): add findEnvrcUpward and findEnvxrcUpward helpers

Thin wrappers over findProjectRoot that look for the specific config
file at the resolved project root and return null if missing. Callers
use null to fall back to their existing no-config behavior (e.g.,
passphrase prompt).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `readEnvrcNearest` convenience wrapper

**Files:**

- Modify: `src/utils/file.ts` (add one method)
- Test: `__tests__/core/file.test.ts` (one `describe` block)

**Rationale:** Command call sites currently do `await FileUtils.readEnvrc(cwd)`. Rather than rewrite 6+ sites as two-line patterns (`findEnvrcUpward` → `readEnvrc`), wrap it once. Caller change becomes a single rename at each site.

- [ ] **Step 1: Write failing tests for `readEnvrcNearest`**

Add this block to `__tests__/core/file.test.ts` next to the other walking tests:

```ts
describe('readEnvrcNearest', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-readenvrc-'));
    tempDir = await fs.realpath(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('returns parsed .envrc contents when found at an ancestor', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeFile(
      path.join(tempDir, '.envrc'),
      'export DEV_SECRET="my-passphrase"\nexport OTHER="value"\n'
    );

    const result = await FileUtils.readEnvrcNearest(sub);
    expect(result).toEqual({
      DEV_SECRET: 'my-passphrase',
      OTHER: 'value',
    });
  });

  it('returns parsed .envrc contents when found in cwd', async () => {
    await fs.writeFile(
      path.join(tempDir, '.envrc'),
      'export PROD_SECRET="p"\n'
    );

    const result = await FileUtils.readEnvrcNearest(tempDir);
    expect(result).toEqual({ PROD_SECRET: 'p' });
  });

  it('returns empty object when no .envrc is found anywhere', async () => {
    const sub = path.join(tempDir, 'nothing', 'here');
    await fs.ensureDir(sub);
    const result = await FileUtils.readEnvrcNearest(sub);
    expect(result).toEqual({});
  });

  it('returns empty object when the project root has .git but no .envrc', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.ensureDir(path.join(tempDir, '.git'));

    const result = await FileUtils.readEnvrcNearest(sub);
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "readEnvrcNearest"
```

Expected: all tests fail with `TypeError: FileUtils.readEnvrcNearest is not a function`.

- [ ] **Step 3: Implement `readEnvrcNearest`**

In `src/utils/file.ts`, add this method inside the `FileUtils` class, immediately after `findEnvxrcUpward`:

```ts
  /**
   * Read the nearest `.envrc` by walking upward from `cwd` via
   * findEnvrcUpward. Returns parsed key/value pairs.
   *
   * Returns an empty object if no `.envrc` is found anywhere along the
   * walk — callers can treat this exactly like "no .envrc in cwd", which
   * is the existing contract for readEnvrc.
   */
  static async readEnvrcNearest(cwd: string): Promise<EnvrcConfig> {
    const dir = await this.findEnvrcUpward(cwd);
    if (dir === null) {
      return {};
    }
    return this.readEnvrc(dir);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "readEnvrcNearest"
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run the full file.test.ts suite to verify nothing regressed**

Run:

```bash
npx jest __tests__/core/file.test.ts
```

Expected: all tests pass (including the pre-existing ones).

- [ ] **Step 6: Commit**

```bash
git add src/utils/file.ts __tests__/core/file.test.ts
git commit -m "$(cat <<'EOF'
feat(file): add readEnvrcNearest convenience wrapper

Wraps findEnvrcUpward + readEnvrc for the common caller pattern. Returns
{} when no .envrc is found, matching the existing readEnvrc(cwd)
contract for a missing file so callers can drop-in replace with no
semantic change beyond the upward walk.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Rewire `getIgnorePatterns` and `getExcludeDirs` to walk

**Files:**

- Modify: `src/utils/file.ts` (change two method bodies)
- Test: `__tests__/core/file.test.ts` (add two `describe` blocks)

**Rationale:** These two methods read from `.envxrc` to drive environment discovery. They currently only look in cwd. When invoked from `packages/db/` in a monorepo, they silently fall back to the hardcoded defaults (`['example', 'sample', 'template']` and the built-in exclude-dirs list), bypassing the root `.envxrc`. That's the symmetric bug to the `.envrc` passphrase bug.

- [ ] **Step 1: Write failing tests for upward `getIgnorePatterns`**

Add this block to `__tests__/core/file.test.ts` (as a standalone `describe` block, not nested inside another one):

```ts
describe('getIgnorePatterns with upward discovery', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-ignoreup-'));
    tempDir = await fs.realpath(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('honors .envxrc.ignore from an ancestor directory', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeJson(path.join(tempDir, '.envxrc'), {
      ignore: ['staging', 'demo'],
    });

    const result = await FileUtils.getIgnorePatterns(sub);
    expect(result).toEqual(['staging', 'demo']);
  });

  it('falls back to defaults when no .envxrc is found anywhere', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);

    const result = await FileUtils.getIgnorePatterns(sub);
    expect(result).toEqual(FileUtils.DEFAULT_IGNORE_PATTERNS);
  });

  it('honors .envxrc.ignore in cwd (backward compat)', async () => {
    await fs.writeJson(path.join(tempDir, '.envxrc'), {
      ignore: ['only-local'],
    });
    const result = await FileUtils.getIgnorePatterns(tempDir);
    expect(result).toEqual(['only-local']);
  });

  it('treats explicit empty ignore array as the escape hatch', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeJson(path.join(tempDir, '.envxrc'), { ignore: [] });

    const result = await FileUtils.getIgnorePatterns(sub);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Write failing tests for upward `getExcludeDirs`**

Add this block alongside the previous one:

```ts
describe('getExcludeDirs with upward discovery', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-excludeup-'));
    tempDir = await fs.realpath(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('honors .envxrc.excludeDirs from an ancestor directory', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeJson(path.join(tempDir, '.envxrc'), {
      excludeDirs: ['vendor', 'legacy'],
    });

    const result = await FileUtils.getExcludeDirs(sub);
    expect(result).toEqual(['vendor', 'legacy']);
  });

  it('falls back to defaults when no .envxrc is found anywhere', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);

    const result = await FileUtils.getExcludeDirs(sub);
    expect(result).toEqual(FileUtils.DEFAULT_EXCLUDE_DIRS);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "with upward discovery"
```

Expected: tests fail — the returned values will be the defaults (or empty-object-derived), not the ancestor's values.

- [ ] **Step 4: Rewire `getIgnorePatterns` and `getExcludeDirs`**

In `src/utils/file.ts`, replace the existing `getIgnorePatterns` method (around line 98) with:

```ts
  /**
   * Get ignore patterns from the nearest `.envxrc` (walking upward) or
   * defaults. An explicit empty array in `.envxrc.ignore` is respected
   * as the "disable filtering" escape hatch.
   */
  static async getIgnorePatterns(cwd: string): Promise<string[]> {
    const dir = await this.findEnvxrcUpward(cwd);
    if (dir === null) {
      return this.DEFAULT_IGNORE_PATTERNS;
    }
    const config = await this.readEnvxrc(dir);
    return config.ignore ?? this.DEFAULT_IGNORE_PATTERNS;
  }
```

And replace `getExcludeDirs` (around line 106) with:

```ts
  /**
   * Get excluded directories from the nearest `.envxrc` (walking upward)
   * or defaults.
   */
  static async getExcludeDirs(cwd: string): Promise<string[]> {
    const dir = await this.findEnvxrcUpward(cwd);
    if (dir === null) {
      return this.DEFAULT_EXCLUDE_DIRS;
    }
    const config = await this.readEnvxrc(dir);
    return config.excludeDirs ?? this.DEFAULT_EXCLUDE_DIRS;
  }
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "with upward discovery"
```

Expected: all 6 tests pass.

- [ ] **Step 6: Run the full file.test.ts suite to check for regressions**

Run:

```bash
npx jest __tests__/core/file.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils/file.ts __tests__/core/file.test.ts
git commit -m "$(cat <<'EOF'
feat(file): resolve .envxrc upward for ignore/exclude patterns

getIgnorePatterns and getExcludeDirs now walk from cwd toward the
project root (first ancestor containing .envrc/.envxrc/.git) so ignore
lists and exclude dirs defined at a monorepo root are honored from
inside a package subdirectory.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Rewire `mergeEnvxrc` to write to the nearest existing file

**Files:**

- Modify: `src/utils/file.ts` (change `mergeEnvxrc` body)
- Test: `__tests__/core/file.test.ts` (add one `describe` block)

**Rationale:** `envx config ignore add demo` from `packages/db/` must edit the root `.envxrc`, not create a shadowing `packages/db/.envxrc`. The fix lives in `mergeEnvxrc`: find the nearest existing `.envxrc` via `findEnvxrcUpward`, fall back to `cwd` only if none exists (greenfield behavior).

- [ ] **Step 1: Write failing tests for updated `mergeEnvxrc`**

Add this block to `__tests__/core/file.test.ts`:

```ts
describe('mergeEnvxrc with upward discovery', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-mergeup-'));
    tempDir = await fs.realpath(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('writes to the nearest existing .envxrc when called from a subdirectory', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    await fs.writeJson(path.join(tempDir, '.envxrc'), {
      ignore: ['demo'],
    });

    const result = await FileUtils.mergeEnvxrc(sub, {
      ignore: ['demo', 'staging'],
    });

    expect(result.success).toBe(true);
    expect(result.filePath).toBe(path.join(tempDir, '.envxrc'));

    // The subdirectory must NOT have gained its own .envxrc.
    expect(await fs.pathExists(path.join(sub, '.envxrc'))).toBe(false);

    // The root file must contain the merged config.
    const rootConfig = await fs.readJson(path.join(tempDir, '.envxrc'));
    expect(rootConfig.ignore).toEqual(['demo', 'staging']);
  });

  it('creates .envxrc in cwd when no ancestor has one', async () => {
    const sub = path.join(tempDir, 'packages', 'db');
    await fs.ensureDir(sub);
    // No .envxrc anywhere up the tree.

    const result = await FileUtils.mergeEnvxrc(sub, {
      ignore: ['demo'],
    });

    expect(result.success).toBe(true);
    expect(result.filePath).toBe(path.join(sub, '.envxrc'));
    expect(await fs.pathExists(path.join(sub, '.envxrc'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "mergeEnvxrc with upward discovery"
```

Expected: the first test fails — the current `mergeEnvxrc` writes to `sub`, not `tempDir`.

- [ ] **Step 3: Rewire `mergeEnvxrc`**

In `src/utils/file.ts`, replace the existing `mergeEnvxrc` method (around line 86-93) with:

```ts
  /**
   * Merge partial config into the nearest existing `.envxrc`.
   *
   * Walks upward from `cwd` via findEnvxrcUpward. If a file is found,
   * writes the merged result to that ancestor (so `envx config …` from a
   * monorepo subdirectory edits the root config, not a package-local
   * shadow). Falls back to creating `.envxrc` in `cwd` only when no
   * ancestor has one (greenfield behavior).
   */
  static async mergeEnvxrc(
    cwd: string,
    partial: Partial<EnvxrcConfig>
  ): Promise<FileOperationResult> {
    const targetDir = (await this.findEnvxrcUpward(cwd)) ?? cwd;
    const existing = await this.readEnvxrc(targetDir);
    const merged: EnvxrcConfig = { ...existing, ...partial };
    return this.writeEnvxrc(targetDir, merged);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "mergeEnvxrc with upward discovery"
```

Expected: both tests pass.

- [ ] **Step 5: Run the full file.test.ts suite to check for regressions**

Run:

```bash
npx jest __tests__/core/file.test.ts
```

Expected: all tests pass, including the pre-existing `mergeEnvxrc` coverage (the old tests call `mergeEnvxrc(tempDir, …)` with no ancestor `.envxrc`, which falls into the cwd branch and still works identically).

- [ ] **Step 6: Commit**

```bash
git add src/utils/file.ts __tests__/core/file.test.ts
git commit -m "$(cat <<'EOF'
feat(file): write .envxrc to nearest existing file

mergeEnvxrc now walks upward via findEnvxrcUpward and writes to the
nearest existing .envxrc. `envx config ignore add` from a monorepo
subdirectory edits the root config instead of creating a shadowing
package-local file. Greenfield behavior (write to cwd) is preserved
when no ancestor has .envxrc.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Drop `.envxrc` from `updateGitignore` defaults

**Files:**

- Modify: `src/utils/file.ts` (one-line change to `secretPatterns`)
- Test: `__tests__/core/file.test.ts` (update existing `updateGitignore` tests)

**Rationale:** `.envxrc` is project config, not a secret. It should be committed so teammates get consistent behavior. Dropping it from `secretPatterns` means `envx init` and any fresh `updateGitignore` call no longer writes `.envxrc` into the project's `.gitignore`. Existing `.gitignore` files are not rewritten — users can remove the entry manually.

- [ ] **Step 1: Update the gitignore test expectations (write the failing assertion)**

In `__tests__/core/file.test.ts`, find the `describe('updateGitignore')` block. Update the following test cases to reflect that `.envxrc` is NOT written:

Replace the test `'should create new .gitignore with EnvX patterns'` body:

```ts
it('should create new .gitignore with EnvX patterns', async () => {
  const result = await FileUtils.updateGitignore(tempDir);

  expect(result.success).toBe(true);
  expect(result.message).toBe(
    'Successfully updated .gitignore with Environment files and EnvX secrets patterns'
  );

  const gitignorePath = path.join(tempDir, '.gitignore');
  const content = await fs.readFile(gitignorePath, 'utf-8');

  expect(content).toContain('# Environment files');
  expect(content).toContain('.env.*');
  expect(content).toContain('!.env.example');
  expect(content).toContain('!.env.*.gpg');
  expect(content).toContain('# EnvX secrets');
  expect(content).toContain('.envrc');
  expect(content).not.toContain('.envxrc');
});
```

Replace the test `'should add only environment patterns when secrets exist'` body:

```ts
it('should add only environment patterns when secrets exist', async () => {
  const gitignorePath = path.join(tempDir, '.gitignore');
  // Only .envrc pre-exists; .envxrc is no longer a gitignore pattern.
  const existingContent = '# Existing\n.envrc';
  await fs.writeFile(gitignorePath, existingContent, 'utf-8');

  const result = await FileUtils.updateGitignore(tempDir);

  expect(result.success).toBe(true);
  expect(result.message).toBe(
    'Successfully updated .gitignore with Environment files patterns'
  );

  const content = await fs.readFile(gitignorePath, 'utf-8');
  expect(content).toContain('# Environment files');
  expect(content).toContain('.env.*');
  expect(content).toContain('!.env.example');
  expect(content).toContain('!.env.*.gpg');
  expect(content).toContain('.envrc');
  expect(content).not.toContain('.envxrc');

  // Should not duplicate .envrc or add another EnvX secrets section
  expect((content.match(/\.envrc\b/g) || []).length).toBe(1);
  expect((content.match(/# EnvX secrets/g) || []).length).toBe(0);
});
```

Replace the test `'should not update when all patterns exist'` body:

```ts
it('should not update when all patterns exist', async () => {
  const gitignorePath = path.join(tempDir, '.gitignore');
  // Pre-existing content that contains every current secret pattern.
  // After removing .envxrc from secretPatterns, only .envrc needs to
  // be present for the "no secrets section needed" path.
  const existingContent =
    'node_modules/\n.env.*\n!.env.example\n!.env.*.gpg\n.envrc';
  await fs.writeFile(gitignorePath, existingContent, 'utf-8');

  const result = await FileUtils.updateGitignore(tempDir);

  expect(result.success).toBe(true);
  expect(result.message).toBe('.gitignore already contains all EnvX patterns');
});
```

- [ ] **Step 2: Add a new test that proves `.envxrc` is not written on a fresh call**

Add this test inside the same `describe('updateGitignore')` block, after the last test:

```ts
it('should not add .envxrc to .gitignore (it is project config, not a secret)', async () => {
  await FileUtils.updateGitignore(tempDir);

  const gitignorePath = path.join(tempDir, '.gitignore');
  const content = await fs.readFile(gitignorePath, 'utf-8');

  expect(content).not.toContain('.envxrc');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "updateGitignore"
```

Expected: at least one of the updated tests fails because the current implementation still writes `.envxrc`.

- [ ] **Step 4: Make the source change**

In `src/utils/file.ts`, find `updateGitignore` (around line 522) and change the `secretPatterns` line.

Before:

```ts
const secretPatterns = ['.envrc', '.envxrc'];
```

After:

```ts
const secretPatterns = ['.envrc'];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:

```bash
npx jest __tests__/core/file.test.ts -t "updateGitignore"
```

Expected: all updateGitignore tests pass.

- [ ] **Step 6: Run the full file.test.ts suite to catch any other assertions**

Run:

```bash
npx jest __tests__/core/file.test.ts
```

Expected: all tests pass. If any other test incidentally checks for `.envxrc` in a generated `.gitignore`, fix that assertion too (none expected based on current test structure, but verify).

- [ ] **Step 7: Commit**

```bash
git add src/utils/file.ts __tests__/core/file.test.ts
git commit -m "$(cat <<'EOF'
fix(file): do not gitignore .envxrc — it is committable project config

.envxrc holds ignore patterns, exclude dirs, and the enrolled
environment list — project configuration meant to be shared across the
team. It never contained secrets. The pattern is dropped from
FileUtils.updateGitignore's secretPatterns.

Existing .gitignore files are not rewritten; users who already have
.envxrc listed can remove it manually.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Rewire `run` command passphrase lookup

**Files:**

- Modify: `src/commands/run.ts` (one-line change at line 317)

**Rationale:** The canonical repro of the reported bug. From `packages/db/` in a monorepo, `envx run -e dev -- pnpm migrate` must find the root `.envrc`.

- [ ] **Step 1: Make the caller switch**

In `src/commands/run.ts`, find the line (around 317):

```ts
const envrc = await FileUtils.readEnvrc(cwd);
```

Replace it with:

```ts
const envrc = await FileUtils.readEnvrcNearest(cwd);
```

- [ ] **Step 2: Run the run command's unit tests to verify no regression**

Run:

```bash
npx jest __tests__/core/run.test.ts
```

Expected: all existing tests pass. (These tests mock the file layer so the rename has no behavioral effect on them — they exist purely as a smoke check that nothing else broke.)

- [ ] **Step 3: Commit**

```bash
git add src/commands/run.ts
git commit -m "$(cat <<'EOF'
fix(run): resolve .envrc upward for monorepo subdirectories

Switch to readEnvrcNearest so `envx run` from a package subdirectory
(e.g., packages/db/) finds the .envrc at the monorepo root instead of
falling through to an interactive passphrase prompt.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Rewire `encrypt`, `decrypt`, and `copy` passphrase lookups

**Files:**

- Modify: `src/commands/encrypt.ts` (line 209)
- Modify: `src/commands/decrypt.ts` (line 226)
- Modify: `src/commands/copy.ts` (lines 304-306)

**Rationale:** Same bug, same fix, three more call sites.

- [ ] **Step 1: Update `encrypt.ts`**

In `src/commands/encrypt.ts`, find (around line 209):

```ts
const envrcConfig = await FileUtils.readEnvrc(cwd);
```

Replace with:

```ts
const envrcConfig = await FileUtils.readEnvrcNearest(cwd);
```

- [ ] **Step 2: Update `decrypt.ts`**

In `src/commands/decrypt.ts`, find (around line 226):

```ts
const envrcConfig = await FileUtils.readEnvrc(cwd);
```

Replace with:

```ts
const envrcConfig = await FileUtils.readEnvrcNearest(cwd);
```

- [ ] **Step 3: Update `copy.ts` (two-line change)**

In `src/commands/copy.ts`, find the lines (around 304-306):

```ts
// Try to get from .envrc file - use root directory for .envrc lookup
const rootCwd = rawOptions.cwd || process.cwd();
const envrcConfig = await FileUtils.readEnvrc(rootCwd);
```

Replace with:

```ts
// Walk upward from the working directory to find the nearest .envrc.
// This makes copy work from monorepo subdirectories.
const envrcConfig = await FileUtils.readEnvrcNearest(
  rawOptions.cwd || process.cwd()
);
```

The stale `rootCwd` variable is removed; no other references to it exist in this block.

- [ ] **Step 4: Run the command-level unit tests**

Run:

```bash
npm run test:core
```

Expected: all core unit tests pass. (Command unit tests mock FileUtils, so the rename has no behavioral effect — this is a smoke check.)

- [ ] **Step 5: Commit**

```bash
git add src/commands/encrypt.ts src/commands/decrypt.ts src/commands/copy.ts
git commit -m "$(cat <<'EOF'
fix(encrypt,decrypt,copy): resolve .envrc upward for monorepo subdirs

All three commands now use readEnvrcNearest so running them from a
package subdirectory finds the monorepo-root .envrc passphrase. The
redundant rootCwd variable in copy.ts is inlined.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Rewire `interactive` command + `InteractiveUtils` passphrase lookups

**Files:**

- Modify: `src/commands/interactive.ts` (lines 67 and 145)
- Modify: `src/utils/interactive.ts` (line 242)

**Rationale:** The interactive setup flow and its helper inside `InteractiveUtils` also read `.envrc` by cwd. Consistency — they should walk upward like the rest.

**Note:** `src/commands/interactive.ts` line 51 also builds `envrcPath` via `path.join(cwd, '.envrc')` to check existence for the "found existing .envrc" branch. **Leave that check alone** — it governs the setup flow's prompts about the local `.envrc`, which should still be cwd-scoped. Only the subsequent `readEnvrc(cwd)` calls (lines 67 and 145) need to walk.

- [ ] **Step 1: Update `src/commands/interactive.ts` line 67**

Find:

```ts
const currentConfig = await FileUtils.readEnvrc(cwd);
```

Replace with:

```ts
const currentConfig = await FileUtils.readEnvrcNearest(cwd);
```

- [ ] **Step 2: Update `src/commands/interactive.ts` line 145**

Find (inside `showEnvrcUsageHelp`):

```ts
const envrcConfig = await FileUtils.readEnvrc(cwd);
```

Replace with:

```ts
const envrcConfig = await FileUtils.readEnvrcNearest(cwd);
```

- [ ] **Step 3: Update `src/utils/interactive.ts` line 242**

Find:

```ts
return await FileUtils.readEnvrc(cwd);
```

Replace with:

```ts
return await FileUtils.readEnvrcNearest(cwd);
```

- [ ] **Step 4: Run the core test suite**

Run:

```bash
npm run test:core
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/interactive.ts src/utils/interactive.ts
git commit -m "$(cat <<'EOF'
fix(interactive): resolve .envrc upward in setup flow

The interactive setup command and its InteractiveUtils helper both now
read .envrc via the upward walk. The existence check that governs the
'found existing .envrc' branch (interactive.ts:51) stays cwd-scoped
because it is specifically about the local file.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Rewire `config` command to read `.envxrc` upward and show resolved path

**Files:**

- Modify: `src/commands/config.ts` (three call sites — `executeConfigShow`, `executeIgnoreList`, `executeExcludeList`)

**Rationale:** `envx config show` from a monorepo subdirectory should display the root `.envxrc` and tell the user which file it came from. `envx config ignore list` / `envx config exclude list` already read via `getIgnorePatterns` / `getExcludeDirs` (which walk after Task 4), but their "is this from defaults?" check reads `readEnvxrc(cwd)` directly — that also needs to walk for consistency.

- [ ] **Step 1: Update `executeConfigShow` to walk and print the resolved path**

In `src/commands/config.ts`, replace the `executeConfigShow` function body (around lines 141-183) with:

```ts
async function executeConfigShow(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  CliUtils.header('EnvX Configuration');

  const envxrcDir = await FileUtils.findEnvxrcUpward(cwd);
  const config = envxrcDir
    ? await FileUtils.readEnvxrc(envxrcDir)
    : await FileUtils.readEnvxrc(cwd);

  if (envxrcDir && envxrcDir !== cwd) {
    CliUtils.info(
      `Reading from: ${chalk.cyan(path.join(envxrcDir, '.envxrc'))}`
    );
    console.log();
  }

  if (Object.keys(config).length === 0) {
    CliUtils.info('No .envxrc found — using default configuration.');
    console.log();
    console.log(
      `Default ignore patterns: ${FileUtils.DEFAULT_IGNORE_PATTERNS.map(p => chalk.gray(p)).join(', ')}`
    );
    console.log(
      `Default excluded dirs: ${FileUtils.DEFAULT_EXCLUDE_DIRS.map(d => chalk.gray(d)).join(', ')}`
    );
    return;
  }

  if (config.ignore && config.ignore.length > 0) {
    console.log(
      `Ignore patterns: ${config.ignore.map(p => chalk.magenta(p)).join(', ')}`
    );
  } else {
    console.log('Ignore patterns: (none)');
  }

  if (config.excludeDirs && config.excludeDirs.length > 0) {
    console.log(
      `Excluded dirs: ${config.excludeDirs.map(d => chalk.yellow(d)).join(', ')}`
    );
  } else {
    console.log(
      `Excluded dirs: (defaults) ${FileUtils.DEFAULT_EXCLUDE_DIRS.map(d => chalk.gray(d)).join(', ')}`
    );
  }

  if (config.environments && config.environments.length > 0) {
    console.log(
      `Managed environments: ${config.environments.map(e => chalk.cyan(e)).join(', ')}`
    );
  }
}
```

- [ ] **Step 2: Add the `path` import if not already present**

At the top of `src/commands/config.ts`, verify `import path from 'path';` is imported. If not, add it alongside the other imports.

- [ ] **Step 3: Update `executeIgnoreList`**

Replace the existing function body (around lines 185-207) with:

```ts
async function executeIgnoreList(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const patterns = await FileUtils.getIgnorePatterns(cwd);

  CliUtils.header('Ignore Patterns');

  if (patterns.length === 0) {
    CliUtils.info('No ignore patterns configured.');
    return;
  }

  const envxrcDir = await FileUtils.findEnvxrcUpward(cwd);
  const config = envxrcDir
    ? await FileUtils.readEnvxrc(envxrcDir)
    : await FileUtils.readEnvxrc(cwd);
  const isDefault = !config.ignore;

  if (isDefault) {
    CliUtils.info('Using default patterns:');
  }

  for (const pattern of patterns) {
    console.log(`  • ${chalk.magenta(pattern)}`);
  }
}
```

- [ ] **Step 4: Update `executeExcludeList`**

Replace the existing function body (around lines 262-284) with:

```ts
async function executeExcludeList(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const dirs = await FileUtils.getExcludeDirs(cwd);

  CliUtils.header('Excluded Directories');

  if (dirs.length === 0) {
    CliUtils.info('No excluded directories configured.');
    return;
  }

  const envxrcDir = await FileUtils.findEnvxrcUpward(cwd);
  const config = envxrcDir
    ? await FileUtils.readEnvxrc(envxrcDir)
    : await FileUtils.readEnvxrc(cwd);
  const isDefault = !config.excludeDirs;

  if (isDefault) {
    CliUtils.info('Using default directories:');
  }

  for (const dir of dirs) {
    console.log(`  • ${chalk.yellow(dir)}`);
  }
}
```

- [ ] **Step 5: Build and run the core test suite**

Run:

```bash
npm run build && npm run test:core
```

Expected: clean build, all core tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/config.ts
git commit -m "$(cat <<'EOF'
fix(config): resolve .envxrc upward and show resolved path

envx config show/ignore list/exclude list now walk upward via
findEnvxrcUpward so a config command run from packages/db/ displays the
monorepo-root .envxrc. `config show` additionally prints the resolved
file path when it was not found in cwd, so users can see where their
displayed config came from.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Integration test reproducing the monorepo bug

**Files:**

- Modify: `__tests__/integration/cli.test.ts` (add a new `describe` block)

**Rationale:** This is the smoking-gun proof that the whole change works end-to-end. It builds a realistic monorepo fixture (`.envrc` + `.envxrc` + `.env.dev.gpg` at the root, plus a `packages/db/` subdirectory with its own encrypted env), runs the compiled CLI against it, and asserts that the passphrase is picked up silently.

**Prerequisite:** The integration test suite invokes `dist/index.js`. Rebuild first.

- [ ] **Step 1: Build the CLI**

Run:

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 2: Add the monorepo integration test**

At the end of the `describe('Run Command', ...)` block in `__tests__/integration/cli.test.ts` (just before its closing `});`), add this new test:

```ts
it('resolves .envrc from a monorepo root when run from a subdirectory', () => {
  // Build fixture:
  //   testDir/.envrc            (passphrase)
  //   testDir/.envxrc           (any json, acts as the project marker)
  //   testDir/packages/db/.env.monorepo.gpg  (encrypted with passphrase)
  //
  // Then: run `envx run -e monorepo --cwd testDir/packages/db -- node …`
  // and verify FOO is injected without an interactive prompt.
  const PASSPHRASE = 'monorepo-walk-pass';
  const pkgDir = path.join(testDir, 'packages', 'db');
  fs.ensureDirSync(pkgDir);

  // .envrc at root with the passphrase under the expected variable name.
  fs.writeFileSync(
    path.join(testDir, '.envrc'),
    'export MONOREPO_SECRET="' + PASSPHRASE + '"\n'
  );
  // .envxrc at root (contents irrelevant for this test).
  fs.writeFileSync(path.join(testDir, '.envxrc'), '{}\n');

  // Create the plain env file inside the package, then encrypt it using
  // the built CLI so the fixture matches reality bit-for-bit.
  fs.writeFileSync(path.join(pkgDir, '.env.monorepo'), 'FOO=bar\nNAME=envx\n');
  const enc = runCli(
    `encrypt -e monorepo -p "${PASSPHRASE}" --overwrite --cwd "${pkgDir}"`
  );
  expect(enc.code).toBe(0);
  // Remove the plain file so only the encrypted one is present — this
  // forces resolveStageFile to pick the .gpg variant, which requires
  // the passphrase.
  fs.removeSync(path.join(pkgDir, '.env.monorepo'));

  // Now run the CLI from the package subdirectory without -p.
  // Pre-fix: this prompts for a passphrase (hangs or fails).
  // Post-fix: the passphrase is resolved from ../../.envrc silently.
  const result = runCli(
    `run -e monorepo --cwd "${pkgDir}" -- node -e "process.stdout.write(process.env.FOO + '|' + process.env.NAME)"`
  );

  expect(result.code).toBe(0);
  expect(result.stdout).toBe('bar|envx');
});
```

- [ ] **Step 3: Run the integration test**

Run:

```bash
npx jest __tests__/integration/cli.test.ts -t "resolves .envrc from a monorepo root"
```

Expected: test passes. If it fails with a timeout (hang), that indicates the upward walk is not wired through to `run`'s passphrase lookup — revisit Task 7.

- [ ] **Step 4: Run the full integration suite to verify nothing regressed**

Run:

```bash
npm run test:integration
```

Expected: all integration tests pass.

- [ ] **Step 5: Commit**

```bash
git add __tests__/integration/cli.test.ts
git commit -m "$(cat <<'EOF'
test(integration): add monorepo .envrc upward discovery test

End-to-end reproduction of the reported bug: .envrc at the testDir
root, encrypted stage file inside packages/db, envx run invoked from
the package subdirectory. Without the fix, the CLI would prompt for a
passphrase and hang in a non-interactive test environment. With the
fix, the passphrase is resolved from the root .envrc silently.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Documentation updates

**Files:**

- Modify: `CLAUDE.md` (Configuration Files section)
- Modify: `README.md` (Configuration Files section)

**Rationale:** Future maintainers (human or LLM) need to know the walking behavior is intentional and where the fence lives. CLAUDE.md is the primary source of truth for this repo; README.md is the user-facing doc.

- [ ] **Step 1: Update `CLAUDE.md`**

In `CLAUDE.md`, find the `### Configuration Files` section. Replace the `.envrc` and `.envxrc` bullets with:

```markdown
- **`.envrc`** — direnv-style shell file (`export KEY="val"`). Holds the GPG passphrase(s). Git-ignored. **Discovered by walking upward from `cwd` via `FileUtils.readEnvrcNearest`** — commands run from a monorepo subdirectory find the `.envrc` at the repo root.

- **`.envxrc`** — JSON project config. **Committable and meant to be shared.** Discovered by walking upward via `FileUtils.findEnvxrcUpward`. Optional fields:
```

Then at the end of the `.envxrc` section (after the `Validated by envxrcFileConfigSchema …` line), append:

```markdown
The upward walk stops at the first ancestor containing any of `.envrc`, `.envxrc`, or `.git` — that ancestor is treated as the project root. If the project root doesn't contain the specific file being looked up, the walk returns `null` and callers fall back to their existing no-config behavior (e.g., passphrase prompt). Writes via `FileUtils.mergeEnvxrc` target the nearest existing `.envxrc`, so `envx config ignore add` from a subdirectory edits the root config.
```

- [ ] **Step 2: Update `README.md`**

In `README.md`, find the section that documents `.envrc` and `.envxrc` (typically titled "Configuration Files" or similar). Add the following paragraph at the end of that section:

```markdown
### Monorepo support

envx discovers `.envrc` (passphrases) and `.envxrc` (project config) by walking upward from the current working directory. Running `envx run -e dev -- pnpm migrate` from `packages/db/` in a turborepo will automatically use the `.envrc` at the repo root — no need to duplicate configuration in every package. The walk stops at the first ancestor containing any of `.envrc`, `.envxrc`, or `.git`, whichever comes first. Stage files (`.env.<stage>[.gpg]`) still resolve from the current directory only.

`.envxrc` is now committed by default — it holds project configuration (ignore patterns, excluded directories, enrolled environments) that should be shared across the team. Only `.envrc` is git-ignored.
```

- [ ] **Step 3: Build and run the full test suite one final time**

Run:

```bash
npm run build && npm test
```

Expected: clean build, all unit and integration tests pass.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "$(cat <<'EOF'
docs: document .envrc/.envxrc upward discovery for monorepos

Explains the new walking behavior in both CLAUDE.md (maintainer guide)
and README.md (user docs). Notes that .envxrc is now committable, the
walk is fenced by the nearest .envrc/.envxrc/.git marker, and stage
files still resolve cwd-only.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification

- [ ] **Step 1: Full build + full test suite**

Run:

```bash
npm run build && npm test
```

Expected: clean build, every test passes.

- [ ] **Step 2: Lint + format checks**

Run:

```bash
npm run lint && npm run format:check
```

Expected: no errors. If prettier wants to reformat anything, run `npm run format` and stage + amend into the most recent docs commit, or create a new `style:` commit.

- [ ] **Step 3: Manual smoke test**

Run these commands manually to verify the fix end-to-end on a real filesystem:

```bash
# Set up a scratch monorepo
cd /tmp
rm -rf envx-monorepo-smoke
mkdir -p envx-monorepo-smoke/packages/db
cd envx-monorepo-smoke
git init >/dev/null
cat > .envrc <<'EOF'
export DEV_SECRET="smoke-test-pass"
EOF
echo '{}' > .envxrc
cat > packages/db/.env.dev <<'EOF'
FOO=bar
EOF

# Encrypt from the subdirectory (this already worked before; it's the
# check that nothing regressed).
node /Users/rahulretnan/Projects/Personal/envx/dist/index.js encrypt \
  -e dev --overwrite --cwd packages/db

# Remove the plain file
rm packages/db/.env.dev

# Run from the subdirectory — WITHOUT -p. This is the bug repro.
node /Users/rahulretnan/Projects/Personal/envx/dist/index.js run \
  -e dev --cwd packages/db -- node -e "console.log(process.env.FOO)"
```

Expected output: `bar`, no passphrase prompt.

- [ ] **Step 4: Clean up the smoke fixture**

```bash
rm -rf /tmp/envx-monorepo-smoke
```

---

## Acceptance Criteria

- `envx run -e <stage> --cwd <subdir> -- <cmd>` from inside a monorepo package finds the passphrase at the repo root's `.envrc` without prompting.
- `envx encrypt`, `envx decrypt`, `envx copy`, and `envx interactive` all resolve `.envrc` by walking upward from their `--cwd` / `process.cwd()`.
- `envx config show` from a subdirectory shows the root `.envxrc` and prints the resolved path.
- `envx config ignore add …` from a subdirectory edits the root `.envxrc`; no new `.envxrc` is created in the subdirectory.
- Running any of the above in a directory with **no** `.envrc`, `.envxrc`, or `.git` up the tree still produces the existing prompts / fallback behavior — nothing breaks for users who aren't in a project.
- `envx init` / `FileUtils.updateGitignore` no longer write `.envxrc` into `.gitignore`. `.envrc` is still ignored.
- `findAllEnvironments(cwd)` / `resolveStageFile(stage, cwd)` still operate cwd-only. No regression in stage file resolution.
- All unit tests, integration tests, and lint checks pass.

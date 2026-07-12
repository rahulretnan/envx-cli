# envx files — Arbitrary Secret-File Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let envx encrypt/decrypt arbitrary registered secret files (google-services.json, .p12 certs, plists) alongside stage-based .env files, per the approved spec at `docs/superpowers/specs/2026-07-12-envx-files-encryption-design.md`.

**Architecture:** A `files` registry in `.envxrc` (`{path, stage?}` entries, root-relative paths). A new `src/commands/files.ts` holds registry management (add/remove/list) plus a shared `processRegisteredFiles` engine (grouping by secret, passphrase resolution, idempotent encrypt, backup-safe decrypt). Existing `encrypt`/`decrypt` ride-along by calling the engine; `list`/`status`/`interactive` get small additive touches. Crypto layer (`ExecUtils`) is untouched.

**Tech Stack:** TypeScript strict, Commander.js, Zod, fs-extra, Jest/ts-jest. System GPG at runtime.

## Global Constraints

- Node `>=14`, TypeScript strict mode, 2-space indent, single quotes, 80-char lines (Prettier enforced).
- No new npm dependencies.
- Existing `ExitCode` enum only — no new exit codes.
- Command pattern: `createXxxCommand()` + exported `executeXxx()` per file in `src/commands/`.
- All utilities are static class methods (no instances).
- `console.log` allowed; all user output through `CliUtils`.
- Pre-existing `@typescript-eslint/no-explicit-any` warnings are expected for raw Commander option objects — do NOT try to fix them elsewhere; new `any` on raw options is consistent with house style.
- Integration tests exec `dist/index.js` — ALWAYS `npm run build` before `npm run test:integration` or full `npm test`.
- If the husky pre-commit hook fails with "ESLint couldn't find eslint.config.js", `node_modules` is missing/stale: run `npm install` first. If the hook still fails on files unrelated to your change, verify `npm run lint` and `npm run format:check` pass manually, then commit with `--no-verify` and note it in the commit body.
- Spec is the source of truth for behavior: `docs/superpowers/specs/2026-07-12-envx-files-encryption-design.md`.

---

### Task 1: Branch, baseline, types + schema for the registry

**Files:**

- Modify: `src/types/index.ts` (add `RegisteredFile`, extend `EnvxrcConfig`)
- Modify: `src/schemas/index.ts` (add `registeredFileSchema`, extend `envxrcFileConfigSchema`)
- Test: `__tests__/core/files-schema.test.ts` (create)

**Interfaces:**

- Consumes: existing `envxrcFileConfigSchema`, `EnvxrcConfig`.
- Produces: `RegisteredFile { path: string; stage?: string }` type; `registeredFileSchema` (Zod, exported); `envxrcFileConfigSchema` accepting optional `files: RegisteredFile[]`. Later tasks import both.

- [ ] **Step 1: Setup — branch and baseline**

```bash
cd /Users/rahulretnan/Projects/Personal/envx
git checkout -b feat/files-encryption
npm install
npm run build && npm test
```

Expected: all existing tests pass (300+ tests). If baseline fails, STOP and report — do not proceed on a broken baseline.

- [ ] **Step 2: Write the failing schema tests**

Create `__tests__/core/files-schema.test.ts`:

```typescript
import {
  envxrcFileConfigSchema,
  registeredFileSchema,
} from '../../src/schemas';

describe('registeredFileSchema', () => {
  it('accepts a global file entry', () => {
    expect(registeredFileSchema.parse({ path: 'certs/signing.p12' })).toEqual({
      path: 'certs/signing.p12',
    });
  });

  it('accepts a stage-bound entry', () => {
    expect(
      registeredFileSchema.parse({
        path: 'android/google-services.json',
        stage: 'production',
      })
    ).toEqual({
      path: 'android/google-services.json',
      stage: 'production',
    });
  });

  it('rejects POSIX absolute paths', () => {
    expect(() =>
      registeredFileSchema.parse({ path: '/etc/secret.json' })
    ).toThrow();
  });

  it('rejects Windows absolute paths', () => {
    expect(() =>
      registeredFileSchema.parse({ path: 'C:\\secret.json' })
    ).toThrow();
  });

  it('rejects .gpg paths', () => {
    expect(() =>
      registeredFileSchema.parse({ path: 'certs/signing.p12.gpg' })
    ).toThrow();
  });

  it('rejects paths escaping the root', () => {
    expect(() =>
      registeredFileSchema.parse({ path: '../outside.json' })
    ).toThrow();
    expect(() =>
      registeredFileSchema.parse({ path: 'certs/../../outside.json' })
    ).toThrow();
  });

  it('rejects empty paths', () => {
    expect(() => registeredFileSchema.parse({ path: '' })).toThrow();
  });

  it('rejects invalid stage names', () => {
    expect(() =>
      registeredFileSchema.parse({ path: 'a.json', stage: 'pro d' })
    ).toThrow();
  });
});

describe('envxrcFileConfigSchema files field', () => {
  it('accepts a config with files', () => {
    const config = {
      ignore: ['example'],
      files: [
        { path: 'certs/signing.p12' },
        { path: 'android/google-services.json', stage: 'production' },
      ],
    };
    expect(envxrcFileConfigSchema.parse(config)).toEqual(config);
  });

  it('still accepts a config without files', () => {
    expect(envxrcFileConfigSchema.parse({})).toEqual({});
  });

  it('rejects a files array with an invalid entry', () => {
    expect(() =>
      envxrcFileConfigSchema.parse({ files: [{ path: '/abs.json' }] })
    ).toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest __tests__/core/files-schema.test.ts`
Expected: FAIL — `registeredFileSchema` is not exported.

- [ ] **Step 4: Implement types**

In `src/types/index.ts`, add after the `EnvxrcConfig` interface (currently `{ ignore?, environments?, excludeDirs? }` around line 82):

```typescript
export interface RegisteredFile {
  path: string; // project-root-relative, POSIX separators
  stage?: string;
}
```

and extend `EnvxrcConfig`:

```typescript
export interface EnvxrcConfig {
  ignore?: string[];
  environments?: string[];
  excludeDirs?: string[];
  files?: RegisteredFile[];
}
```

- [ ] **Step 5: Implement schema**

In `src/schemas/index.ts`, add directly above `envxrcFileConfigSchema`:

```typescript
export const registeredFileSchema = z.object({
  path: z
    .string()
    .min(1, 'Path is required')
    .refine(p => !/^([A-Za-z]:[\\/]|[\\/])/.test(p), {
      message: 'Path must be relative to the project root',
    })
    .refine(p => !p.endsWith('.gpg'), {
      message: 'Register the plaintext path, not the .gpg file',
    })
    .refine(p => !p.split(/[\\/]/).includes('..'), {
      message: 'Path must not escape the project root',
    }),
  stage: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid stage name')
    .optional(),
});
```

and extend `envxrcFileConfigSchema`:

```typescript
export const envxrcFileConfigSchema = z.object({
  ignore: z.array(z.string()).optional(),
  environments: z.array(z.string()).optional(),
  excludeDirs: z.array(z.string()).optional(),
  files: z.array(registeredFileSchema).optional(),
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest __tests__/core/files-schema.test.ts`
Expected: PASS (11 tests).

Then run the full core suite to confirm nothing regressed (readEnvxrc round-trips configs through this schema):

Run: `npm run test:core`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/schemas/index.ts __tests__/core/files-schema.test.ts
git commit -m "feat(files): add RegisteredFile type and .envxrc files schema"
```

---

### Task 2: FileUtils registry helpers

**Files:**

- Modify: `src/utils/file.ts`
- Test: `__tests__/core/files-utils.test.ts` (create)

**Interfaces:**

- Consumes: `RegisteredFile` from `../types`; existing `findEnvxrcUpward`, `readEnvxrc`, `fileExists`.
- Produces (all on `FileUtils`, used by Tasks 3–6):
  - `static readonly FILES_SECRET_NAME = 'FILES_SECRET'`
  - `static async getRegisteredFiles(cwd: string): Promise<{ root: string; entries: RegisteredFile[] }>` — `root` is the dir holding the nearest `.envxrc`, or `cwd` when none exists; `entries` is `config.files ?? []`.
  - `static rebaseToRoot(inputPath: string, cwd: string, root: string): string` — resolves against `cwd`, returns root-relative POSIX path; throws `Error` if the result escapes `root` or equals it.
  - `static async addFilesToGitignore(cwd: string, relPaths: string[]): Promise<FileOperationResult>` — appends `# EnvX files` section with `<path>` and `!<path>.gpg` lines, exact-line dedupe.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/core/files-utils.test.ts`:

```typescript
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { FileUtils } from '../../src/utils/file';

describe('FileUtils registered-files helpers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-files-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  describe('FILES_SECRET_NAME', () => {
    it('is FILES_SECRET', () => {
      expect(FileUtils.FILES_SECRET_NAME).toBe('FILES_SECRET');
    });
  });

  describe('rebaseToRoot', () => {
    it('returns the path unchanged when cwd is the root', () => {
      expect(FileUtils.rebaseToRoot('certs/a.p12', tmpDir, tmpDir)).toBe(
        'certs/a.p12'
      );
    });

    it('re-bases a path given from a subdirectory', () => {
      const sub = path.join(tmpDir, 'packages', 'app');
      expect(FileUtils.rebaseToRoot('a.p12', sub, tmpDir)).toBe(
        'packages/app/a.p12'
      );
    });

    it('accepts an absolute path inside the root', () => {
      expect(
        FileUtils.rebaseToRoot(path.join(tmpDir, 'x.json'), tmpDir, tmpDir)
      ).toBe('x.json');
    });

    it('throws when the path escapes the root', () => {
      expect(() =>
        FileUtils.rebaseToRoot('../outside.json', tmpDir, tmpDir)
      ).toThrow(/project root/);
    });

    it('throws when the path IS the root', () => {
      expect(() => FileUtils.rebaseToRoot('.', tmpDir, tmpDir)).toThrow();
    });
  });

  describe('getRegisteredFiles', () => {
    it('returns empty entries with cwd root when no .envxrc exists', async () => {
      const result = await FileUtils.getRegisteredFiles(tmpDir);
      expect(result).toEqual({ root: tmpDir, entries: [] });
    });

    it('returns entries from .envxrc', async () => {
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({
          files: [
            { path: 'certs/signing.p12' },
            { path: 'android/google-services.json', stage: 'production' },
          ],
        })
      );
      const result = await FileUtils.getRegisteredFiles(tmpDir);
      expect(result.root).toBe(tmpDir);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].path).toBe('certs/signing.p12');
    });

    it('walks upward from a subdirectory', async () => {
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({ files: [{ path: 'a.json' }] })
      );
      const sub = path.join(tmpDir, 'packages', 'app');
      await fs.ensureDir(sub);
      const result = await FileUtils.getRegisteredFiles(sub);
      expect(result.root).toBe(tmpDir);
      expect(result.entries).toHaveLength(1);
    });

    it('returns empty entries when .envxrc has no files field', async () => {
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({ ignore: ['example'] })
      );
      const result = await FileUtils.getRegisteredFiles(tmpDir);
      expect(result.entries).toEqual([]);
    });
  });

  describe('addFilesToGitignore', () => {
    it('creates .gitignore with an EnvX files section', async () => {
      const result = await FileUtils.addFilesToGitignore(tmpDir, [
        'certs/signing.p12',
      ]);
      expect(result.success).toBe(true);
      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content).toContain('# EnvX files');
      expect(content).toContain('certs/signing.p12');
      expect(content).toContain('!certs/signing.p12.gpg');
    });

    it('is idempotent', async () => {
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content.match(/^a\.json$/gm)).toHaveLength(1);
      expect(content.match(/^!a\.json\.gpg$/gm)).toHaveLength(1);
    });

    it('adds the plaintext line even when only the negated .gpg line exists', async () => {
      // substring trap: "!a.json.gpg" contains "a.json"
      await fs.writeFile(path.join(tmpDir, '.gitignore'), '!a.json.gpg\n');
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content.match(/^a\.json$/gm)).toHaveLength(1);
    });

    it('preserves existing content', async () => {
      await fs.writeFile(path.join(tmpDir, '.gitignore'), 'node_modules\n');
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content).toContain('node_modules');
      expect(content).toContain('a.json');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/core/files-utils.test.ts`
Expected: FAIL — `FILES_SECRET_NAME`, `rebaseToRoot`, `getRegisteredFiles`, `addFilesToGitignore` do not exist.

- [ ] **Step 3: Implement the helpers**

In `src/utils/file.ts`:

Add `RegisteredFile` to the existing types import:

```typescript
import {
  EnvFile,
  EnvrcConfig,
  EnvxrcConfig,
  FileOperationResult,
  RegisteredFile,
} from '../types';
```

Add the constant next to the existing `DEFAULT_*` constants at the top of the class:

```typescript
static readonly FILES_SECRET_NAME = 'FILES_SECRET';
```

Add the three methods after `findEnvxrcUpward` (around line 322):

```typescript
/**
 * Read the registered-files list from the nearest `.envxrc` (upward
 * walk). Returns the directory holding the registry — which is also the
 * base for resolving entry paths — plus the entries. When no `.envxrc`
 * exists anywhere, root falls back to `cwd` and entries are empty.
 */
static async getRegisteredFiles(
  cwd: string
): Promise<{ root: string; entries: RegisteredFile[] }> {
  const dir = await this.findEnvxrcUpward(cwd);
  if (dir === null) {
    return { root: cwd, entries: [] };
  }
  const config = await this.readEnvxrc(dir);
  return { root: dir, entries: config.files ?? [] };
}

/**
 * Resolve a user-supplied path against `cwd` and re-base it relative to
 * `root`, normalized to POSIX separators. Throws when the result would
 * escape the root (or is the root itself) — registry paths must stay
 * inside the project.
 */
static rebaseToRoot(inputPath: string, cwd: string, root: string): string {
  const abs = path.resolve(cwd, inputPath);
  const rel = path.relative(root, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Path must stay inside the project root (${root}): ${inputPath}`
    );
  }
  return rel.split(path.sep).join('/');
}

/**
 * Append registered-file ignore rules to .gitignore under an
 * "# EnvX files" section: the plaintext path plus !<path>.gpg so the
 * encrypted sibling stays committable. Exact-line dedupe (substring
 * matching would treat "!a.json.gpg" as covering "a.json").
 */
static async addFilesToGitignore(
  cwd: string,
  relPaths: string[]
): Promise<FileOperationResult> {
  const gitignorePath = path.join(cwd, '.gitignore');

  try {
    let existingContent = '';
    if (await this.fileExists(gitignorePath)) {
      existingContent = await fs.readFile(gitignorePath, 'utf-8');
    }

    const existingLines = new Set(
      existingContent.split('\n').map(line => line.trim())
    );

    const missing: string[] = [];
    for (const rel of relPaths) {
      for (const line of [rel, `!${rel}.gpg`]) {
        if (!existingLines.has(line)) {
          missing.push(line);
        }
      }
    }

    if (missing.length === 0) {
      return {
        success: true,
        message: '.gitignore already contains EnvX file patterns',
        filePath: gitignorePath,
      };
    }

    let newContent = existingContent.trim();
    newContent +=
      (newContent ? '\n\n' : '') + ['# EnvX files', ...missing].join('\n');
    newContent += '\n';

    await fs.writeFile(gitignorePath, newContent, 'utf-8');

    return {
      success: true,
      message: `Added ${missing.length} pattern(s) to .gitignore`,
      filePath: gitignorePath,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update .gitignore: ${error}`,
      filePath: gitignorePath,
      error: error as Error,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/core/files-utils.test.ts`
Expected: PASS (13 tests). Then `npm run test:core` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/file.ts __tests__/core/files-utils.test.ts
git commit -m "feat(files): FileUtils registry helpers (getRegisteredFiles, rebaseToRoot, addFilesToGitignore)"
```

---

### Task 3: `envx files add|remove|list` + command registration

**Files:**

- Create: `src/commands/files.ts`
- Modify: `src/index.ts` (register command)
- Test: `__tests__/core/files-command.test.ts` (create)

**Interfaces:**

- Consumes: Task 1 `registeredFileSchema`, `RegisteredFile`; Task 2 `FileUtils` helpers; existing `CliUtils`, `ExecUtils.exec`, `InteractiveUtils.confirmOperation`, `mergeEnvxrc`, `validateSchema`.
- Produces (from `src/commands/files.ts`, used by Tasks 4–6):
  - `createFilesCommand(): Command`
  - `executeFilesAdd(filePath: string, rawOptions: any): Promise<void>`
  - `executeFilesRemove(filePath: string, rawOptions: any): Promise<void>`
  - `executeFilesList(rawOptions: any): Promise<void>`
  - `getRegisteredFileStatus(root: string, entry: RegisteredFile): Promise<{ plain: boolean; enc: boolean; label: string }>`
  - `class FilesError extends Error { exitCode: ExitCode }` (module-internal pattern, mirrors `RunError` in `run.ts`)

- [ ] **Step 1: Write the failing tests**

Create `__tests__/core/files-command.test.ts`:

```typescript
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { executeFilesAdd, executeFilesRemove } from '../../src/commands/files';
import { FileUtils } from '../../src/utils/file';
import { InteractiveUtils } from '../../src/utils/interactive';

describe('envx files add/remove', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-filescmd-'));
    jest.spyOn(InteractiveUtils, 'confirmOperation').mockResolvedValue(true);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
    jest.restoreAllMocks();
  });

  const readEnvxrc = async () =>
    JSON.parse(await fs.readFile(path.join(tmpDir, '.envxrc'), 'utf-8'));

  it('add registers a global file and updates .gitignore', async () => {
    await fs.ensureDir(path.join(tmpDir, 'certs'));
    await fs.writeFile(path.join(tmpDir, 'certs/signing.p12'), 'data');

    await executeFilesAdd('certs/signing.p12', { cwd: tmpDir });

    const config = await readEnvxrc();
    expect(config.files).toEqual([{ path: 'certs/signing.p12' }]);

    const gitignore = await fs.readFile(
      path.join(tmpDir, '.gitignore'),
      'utf-8'
    );
    expect(gitignore).toContain('certs/signing.p12');
    expect(gitignore).toContain('!certs/signing.p12.gpg');
  });

  it('add registers a stage-bound file', async () => {
    await fs.writeFile(path.join(tmpDir, 'gs.json'), '{}');

    await executeFilesAdd('gs.json', {
      cwd: tmpDir,
      environment: 'production',
    });

    const config = await readEnvxrc();
    expect(config.files).toEqual([{ path: 'gs.json', stage: 'production' }]);
  });

  it('add with --no-gitignore skips .gitignore', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.json'), '{}');

    // commander maps --no-gitignore to { gitignore: false }
    await executeFilesAdd('a.json', { cwd: tmpDir, gitignore: false });

    expect(await fs.pathExists(path.join(tmpDir, '.gitignore'))).toBe(false);
  });

  it('add is a warning no-op on duplicates', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.json'), '{}');
    await executeFilesAdd('a.json', { cwd: tmpDir });
    await executeFilesAdd('a.json', { cwd: tmpDir });

    const config = await readEnvxrc();
    expect(config.files).toHaveLength(1);
  });

  it('add rejects a .gpg path', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.json.gpg'), 'x');
    await expect(
      executeFilesAdd('a.json.gpg', { cwd: tmpDir })
    ).rejects.toThrow(/plaintext/);
  });

  it('add rejects a path outside the project root', async () => {
    await expect(
      executeFilesAdd('../outside.json', { cwd: tmpDir })
    ).rejects.toThrow(/project root/);
  });

  it('add from a subdirectory re-bases to the .envxrc root', async () => {
    await fs.writeFile(path.join(tmpDir, '.envxrc'), '{}');
    const sub = path.join(tmpDir, 'packages', 'app');
    await fs.ensureDir(sub);
    await fs.writeFile(path.join(sub, 'gs.json'), '{}');

    await executeFilesAdd('gs.json', { cwd: sub });

    const config = await readEnvxrc();
    expect(config.files).toEqual([{ path: 'packages/app/gs.json' }]);
  });

  it('remove deletes the entry and leaves .gitignore alone', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.json'), '{}');
    await executeFilesAdd('a.json', { cwd: tmpDir });

    await executeFilesRemove('a.json', { cwd: tmpDir });

    const config = await readEnvxrc();
    expect(config.files).toEqual([]);
    const gitignore = await fs.readFile(
      path.join(tmpDir, '.gitignore'),
      'utf-8'
    );
    expect(gitignore).toContain('a.json'); // untouched by design
  });

  it('remove warns (no throw) when not registered', async () => {
    await expect(
      executeFilesRemove('nope.json', { cwd: tmpDir })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/core/files-command.test.ts`
Expected: FAIL — `src/commands/files.ts` does not exist.

- [ ] **Step 3: Create `src/commands/files.ts` (management half)**

```typescript
import chalk from 'chalk';
import { Command } from 'commander';
import path from 'path';
import { registeredFileSchema, validateSchema } from '../schemas';
import { ExitCode, RegisteredFile } from '../types';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';
import { InteractiveUtils } from '../utils/interactive';

/**
 * Error carrying a specific exit code, mirroring RunError in run.ts.
 */
class FilesError extends Error {
  constructor(
    message: string,
    public exitCode: ExitCode
  ) {
    super(message);
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RawFilesOptions = any;

const actionWrapper =
  (fn: (...args: string[]) => Promise<void>, label: string) =>
  async (...args: unknown[]) => {
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      await (fn as any)(...args);
    } catch (error) {
      CliUtils.error(
        `${label} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      const exit =
        (error as { exitCode?: number }).exitCode ?? ExitCode.GENERAL_ERROR;
      process.exit(exit);
    }
  };

export const createFilesCommand = (): Command => {
  const files = new Command('files');

  files.description('Manage and encrypt registered secret files');

  files
    .command('add <path>')
    .description('Register a file for encryption (optionally stage-bound)')
    .option('-e, --environment <env>', 'Bind the file to a stage')
    .option('--no-gitignore', 'Skip updating .gitignore')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(actionWrapper(executeFilesAdd, 'Files add'));

  files
    .command('remove <path>')
    .description('Unregister a file (leaves .gitignore untouched)')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(actionWrapper(executeFilesRemove, 'Files remove'));

  files
    .command('list')
    .description('List registered files and their encryption status')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(actionWrapper(executeFilesList, 'Files list'));

  return files;
};

/**
 * Status of a registered file on disk. Shared by `files list`, `envx list`
 * and `envx status`.
 */
export async function getRegisteredFileStatus(
  root: string,
  entry: RegisteredFile
): Promise<{ plain: boolean; enc: boolean; label: string }> {
  const abs = path.join(root, entry.path);
  const plain = await FileUtils.fileExists(abs);
  const enc = await FileUtils.fileExists(FileUtils.getEncryptedPath(abs));

  let label: string;
  if (plain && enc) {
    label = chalk.green('Encrypted');
  } else if (!plain && enc) {
    label = chalk.green('Encrypted only');
  } else if (plain) {
    label = chalk.yellow('Unencrypted');
  } else {
    label = chalk.red('Missing');
  }

  return { plain, enc, label };
}

export async function executeFilesAdd(
  filePath: string,
  rawOptions: RawFilesOptions
): Promise<void> {
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();
  const { root, entries } = await FileUtils.getRegisteredFiles(cwd);

  const rel = FileUtils.rebaseToRoot(filePath, cwd, root);

  const entry: RegisteredFile = rawOptions.environment
    ? { path: rel, stage: String(rawOptions.environment) }
    : { path: rel };
  validateSchema(registeredFileSchema, entry);

  if (entries.some(e => e.path === rel)) {
    CliUtils.warning(`'${rel}' is already registered.`);
    return;
  }

  const abs = path.join(root, rel);
  if (!(await FileUtils.fileExists(abs))) {
    const proceed = await InteractiveUtils.confirmOperation(
      `File ${chalk.cyan(rel)} does not exist yet. Register anyway?`,
      false
    );
    if (!proceed) {
      CliUtils.info('Operation cancelled.');
      return;
    }
  }

  // Warn if the plaintext is already tracked by git — the secret may
  // already be in history.
  const tracked = ExecUtils.exec(`git ls-files --error-unmatch "${rel}"`, {
    silent: true,
    cwd: root,
  });
  if (tracked.success) {
    CliUtils.warning(
      `${rel} is tracked by git — the plaintext may already be committed. ` +
        'Consider `git rm --cached` after encrypting.'
    );
  }

  const result = await FileUtils.mergeEnvxrc(cwd, {
    files: [...entries, entry],
  });
  if (!result.success) {
    throw new FilesError(
      `Failed to update config: ${result.message}`,
      ExitCode.FILE_ERROR
    );
  }

  CliUtils.success(
    `Registered '${rel}'${
      entry.stage
        ? ` for ${CliUtils.formatEnvironment(entry.stage)}`
        : ' (global)'
    }.`
  );

  // commander maps --no-gitignore to gitignore: false
  if (rawOptions.gitignore !== false) {
    const gitignoreResult = await FileUtils.addFilesToGitignore(root, [rel]);
    if (gitignoreResult.success) {
      CliUtils.success(gitignoreResult.message);
    } else {
      CliUtils.warning(
        `Could not update .gitignore: ${gitignoreResult.message}`
      );
    }
  }
}

export async function executeFilesRemove(
  filePath: string,
  rawOptions: RawFilesOptions
): Promise<void> {
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();
  const { root, entries } = await FileUtils.getRegisteredFiles(cwd);

  const rel = FileUtils.rebaseToRoot(filePath, cwd, root);

  const index = entries.findIndex(e => e.path === rel);
  if (index === -1) {
    CliUtils.warning(`'${rel}' is not registered.`);
    return;
  }

  const next = [...entries];
  next.splice(index, 1);

  const result = await FileUtils.mergeEnvxrc(cwd, { files: next });
  if (!result.success) {
    throw new FilesError(
      `Failed to update config: ${result.message}`,
      ExitCode.FILE_ERROR
    );
  }

  CliUtils.success(`Removed '${rel}' from the registry.`);
  CliUtils.info('.gitignore entries were left in place.');
}

export async function executeFilesList(
  rawOptions: RawFilesOptions
): Promise<void> {
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();
  const { root, entries } = await FileUtils.getRegisteredFiles(cwd);

  CliUtils.header('Registered Files');

  if (entries.length === 0) {
    CliUtils.info(
      'No files registered. Use "envx files add <path>" to register one.'
    );
    return;
  }

  const rows: string[][] = [];
  for (const entry of entries) {
    const status = await getRegisteredFileStatus(root, entry);
    rows.push([
      chalk.cyan(entry.path),
      entry.stage
        ? CliUtils.formatEnvironment(entry.stage)
        : chalk.gray('global'),
      status.plain ? 'yes' : '—',
      status.enc ? 'yes' : '—',
      status.label,
    ]);
  }

  CliUtils.printTable(
    ['Path', 'Stage', 'Plaintext', 'Encrypted', 'Status'],
    rows
  );
}
```

- [ ] **Step 4: Register the command in `src/index.ts`**

Add the import next to the other command imports:

```typescript
import { createFilesCommand } from './commands/files';
```

Add after `program.addCommand(createRunCommand());` (line 57):

```typescript
program.addCommand(createFilesCommand());
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/core/files-command.test.ts`
Expected: PASS (9 tests). Then `npm run test:core` — PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/files.ts src/index.ts __tests__/core/files-command.test.ts
git commit -m "feat(files): envx files add/remove/list registry management"
```

---

### Task 4: `processRegisteredFiles` engine + `files encrypt|decrypt`

**Files:**

- Modify: `src/commands/files.ts` (append engine + two subcommands)
- Test: `__tests__/core/files-engine.test.ts` (create)

**Interfaces:**

- Consumes: Task 2/3 outputs; existing `ExecUtils.testGpgOperation`, `encryptFile`, `decryptFile`, `isGpgAvailable`; `FileUtils.readEnvrcNearest`, `filesAreIdentical`, `createBackup`, `removeBackup`, `getEncryptedPath`, `generateSecretVariableName`.
- Produces (used by Task 5 ride-along):
  - `interface FilesProcessOptions { mode: 'encrypt' | 'decrypt'; rawOptions: any; passphraseOverride?: string; isPartOfAll?: boolean }`
  - `processRegisteredFiles(entries: RegisteredFile[], root: string, opts: FilesProcessOptions): Promise<{ successCount: number; errorCount: number }>`
  - `executeFilesEncrypt(filePath: string | undefined, rawOptions: any): Promise<void>`
  - `executeFilesDecrypt(filePath: string | undefined, rawOptions: any): Promise<void>`

**Behavior contract (from spec §3–§4, §6):**

- Group entries by secret var: `generateSecretVariableName(stage)` for stage-bound, `FILES_SECRET_NAME` for global.
- Per group resolve passphrase: `passphraseOverride` → `rawOptions.passphrase` → `rawOptions.secret` in `.envrc` → group var in `.envrc` → prompt.
- `--dry-run`: print `would encrypt/decrypt` lines with the secret var name, count as success, never touch gpg.
- `testGpgOperation` once per distinct passphrase.
- Encrypt idempotency: existing `.gpg` → decrypt to temp `${abs}.temp.${Date.now()}`, `filesAreIdentical`, skip when identical (success), always remove temp.
- Decrypt safety: backup existing plaintext, restore on failure, remove on success; per-file overwrite confirm unless `overwrite` or `isPartOfAll`.
- Missing plaintext (encrypt) / missing `.gpg` (decrypt): warn + skip, no count.
- Per-file failures: count, continue.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/core/files-engine.test.ts`:

```typescript
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { processRegisteredFiles } from '../../src/commands/files';
import { ExecUtils } from '../../src/utils/exec';
import { InteractiveUtils } from '../../src/utils/interactive';

describe('processRegisteredFiles', () => {
  let tmpDir: string;
  let encryptSpy: jest.SpyInstance;
  let decryptSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-engine-'));
    await fs.writeFile(
      path.join(tmpDir, '.envrc'),
      [
        'export PRODUCTION_SECRET="prod-pass"',
        'export FILES_SECRET="files-pass"',
        '',
      ].join('\n')
    );

    jest
      .spyOn(ExecUtils, 'testGpgOperation')
      .mockReturnValue({ success: true, message: 'ok' });
    encryptSpy = jest
      .spyOn(ExecUtils, 'encryptFile')
      .mockImplementation((filePath: string) => {
        fs.writeFileSync(`${filePath}.gpg`, 'ciphertext');
        return { success: true, message: 'ok' };
      });
    decryptSpy = jest
      .spyOn(ExecUtils, 'decryptFile')
      .mockImplementation((enc: string, out: string) => {
        fs.writeFileSync(out, 'plaintext');
        return { success: true, message: 'ok' };
      });
    jest
      .spyOn(InteractiveUtils, 'promptPassphrase')
      .mockResolvedValue('prompted-pass');
    jest.spyOn(InteractiveUtils, 'confirmOperation').mockResolvedValue(true);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
    jest.restoreAllMocks();
  });

  it('encrypts a global file with FILES_SECRET', async () => {
    await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'data');

    const result = await processRegisteredFiles(
      [{ path: 'cert.p12' }],
      tmpDir,
      { mode: 'encrypt', rawOptions: {} }
    );

    expect(result).toEqual({ successCount: 1, errorCount: 0 });
    expect(encryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'cert.p12'),
      'files-pass'
    );
  });

  it('encrypts a stage-bound file with the stage secret', async () => {
    await fs.writeFile(path.join(tmpDir, 'gs.json'), '{}');

    await processRegisteredFiles(
      [{ path: 'gs.json', stage: 'production' }],
      tmpDir,
      { mode: 'encrypt', rawOptions: {} }
    );

    expect(encryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'gs.json'),
      'prod-pass'
    );
  });

  it('uses passphraseOverride over everything else', async () => {
    await fs.writeFile(path.join(tmpDir, 'gs.json'), '{}');

    await processRegisteredFiles(
      [{ path: 'gs.json', stage: 'production' }],
      tmpDir,
      { mode: 'encrypt', rawOptions: {}, passphraseOverride: 'override' }
    );

    expect(encryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'gs.json'),
      'override'
    );
  });

  it('prompts when no secret is available', async () => {
    await fs.remove(path.join(tmpDir, '.envrc'));
    await fs.writeFile(path.join(tmpDir, '.envxrc'), '{}'); // root marker
    await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'data');

    await processRegisteredFiles([{ path: 'cert.p12' }], tmpDir, {
      mode: 'encrypt',
      rawOptions: {},
    });

    expect(InteractiveUtils.promptPassphrase).toHaveBeenCalled();
    expect(encryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'cert.p12'),
      'prompted-pass'
    );
  });

  it('dry-run counts but never calls gpg', async () => {
    await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'data');

    const result = await processRegisteredFiles(
      [{ path: 'cert.p12' }],
      tmpDir,
      { mode: 'encrypt', rawOptions: { dryRun: true } }
    );

    expect(result).toEqual({ successCount: 1, errorCount: 0 });
    expect(encryptSpy).not.toHaveBeenCalled();
    expect(ExecUtils.testGpgOperation).not.toHaveBeenCalled();
  });

  it('skips (no counts) when plaintext is missing on encrypt', async () => {
    const result = await processRegisteredFiles(
      [{ path: 'missing.p12' }],
      tmpDir,
      { mode: 'encrypt', rawOptions: {} }
    );

    expect(result).toEqual({ successCount: 0, errorCount: 0 });
    expect(encryptSpy).not.toHaveBeenCalled();
  });

  it('skips re-encrypt when existing .gpg has identical content', async () => {
    await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'data');
    await fs.writeFile(path.join(tmpDir, 'cert.p12.gpg'), 'old-cipher');
    // decryptFile mock writes 'plaintext'; make plaintext match:
    await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'plaintext');

    const result = await processRegisteredFiles(
      [{ path: 'cert.p12' }],
      tmpDir,
      { mode: 'encrypt', rawOptions: {} }
    );

    expect(result).toEqual({ successCount: 1, errorCount: 0 });
    expect(encryptSpy).not.toHaveBeenCalled(); // identical → skip
  });

  it('decrypts a .gpg into the plaintext path', async () => {
    await fs.writeFile(path.join(tmpDir, 'cert.p12.gpg'), 'cipher');

    const result = await processRegisteredFiles(
      [{ path: 'cert.p12' }],
      tmpDir,
      { mode: 'decrypt', rawOptions: { overwrite: true } }
    );

    expect(result).toEqual({ successCount: 1, errorCount: 0 });
    expect(decryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'cert.p12.gpg'),
      path.join(tmpDir, 'cert.p12'),
      'files-pass'
    );
  });

  it('skips decrypt when no .gpg exists', async () => {
    const result = await processRegisteredFiles(
      [{ path: 'cert.p12' }],
      tmpDir,
      { mode: 'decrypt', rawOptions: {} }
    );

    expect(result).toEqual({ successCount: 0, errorCount: 0 });
  });

  it('counts errors and continues when gpg fails', async () => {
    encryptSpy.mockReturnValue({ success: false, message: 'boom' });
    await fs.writeFile(path.join(tmpDir, 'a.p12'), 'x');
    await fs.writeFile(path.join(tmpDir, 'b.p12'), 'y');

    const result = await processRegisteredFiles(
      [{ path: 'a.p12' }, { path: 'b.p12' }],
      tmpDir,
      { mode: 'encrypt', rawOptions: {} }
    );

    expect(result).toEqual({ successCount: 0, errorCount: 2 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/core/files-engine.test.ts`
Expected: FAIL — `processRegisteredFiles` is not exported.

- [ ] **Step 3: Append the engine to `src/commands/files.ts`**

```typescript
export interface FilesProcessOptions {
  mode: 'encrypt' | 'decrypt';
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  rawOptions: any;
  /** Ride-along: an already-resolved stage passphrase (skips resolution). */
  passphraseOverride?: string;
  isPartOfAll?: boolean;
}

/**
 * Encrypt or decrypt registered files. Groups entries by their secret
 * variable (stage secret or FILES_SECRET), resolves one passphrase per
 * group, GPG-tests each distinct passphrase once, then processes files
 * with the same idempotency (encrypt) and backup/restore (decrypt)
 * behavior the env commands use.
 */
export async function processRegisteredFiles(
  entries: RegisteredFile[],
  root: string,
  opts: FilesProcessOptions
): Promise<{ successCount: number; errorCount: number }> {
  const { mode, rawOptions, passphraseOverride, isPartOfAll } = opts;
  let successCount = 0;
  let errorCount = 0;

  if (entries.length === 0) {
    return { successCount, errorCount };
  }

  // Group by secret variable
  const groups = new Map<string, RegisteredFile[]>();
  for (const entry of entries) {
    const key = entry.stage
      ? FileUtils.generateSecretVariableName(entry.stage)
      : FileUtils.FILES_SECRET_NAME;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const envrcConfig = await FileUtils.readEnvrcNearest(root);
  const testedPassphrases = new Set<string>();

  for (const [secretVar, groupEntries] of groups) {
    // Resolve passphrase: override > -p > -s > <secretVar> > prompt
    let passphrase: string = passphraseOverride || rawOptions.passphrase || '';
    if (!passphrase || passphrase.trim() === '') {
      if (rawOptions.secret && envrcConfig[rawOptions.secret]) {
        passphrase = envrcConfig[rawOptions.secret];
        CliUtils.info(
          `Using secret from .envrc: ${chalk.cyan(rawOptions.secret)}`
        );
      } else if (envrcConfig[secretVar]) {
        passphrase = envrcConfig[secretVar];
        CliUtils.info(`Using secret from .envrc: ${chalk.cyan(secretVar)}`);
      } else if (!rawOptions.dryRun) {
        passphrase = await InteractiveUtils.promptPassphrase(
          `Enter ${mode === 'encrypt' ? 'encryption' : 'decryption'} passphrase (${secretVar}):`
        );
      }
    }

    // Dry-run: report and count, never touch gpg
    if (rawOptions.dryRun) {
      for (const entry of groupEntries) {
        console.log(
          `  would ${mode}: ${chalk.cyan(entry.path)} (${secretVar})`
        );
        successCount++;
      }
      continue;
    }

    if (!testedPassphrases.has(passphrase)) {
      const gpgTest = ExecUtils.testGpgOperation(passphrase);
      if (!gpgTest.success) {
        CliUtils.error(`GPG test failed for ${secretVar}: ${gpgTest.message}`);
        errorCount += groupEntries.length;
        continue;
      }
      testedPassphrases.add(passphrase);
    }

    for (const entry of groupEntries) {
      try {
        const outcome =
          mode === 'encrypt'
            ? await encryptRegisteredFile(root, entry, passphrase)
            : await decryptRegisteredFile(
                root,
                entry,
                passphrase,
                rawOptions,
                isPartOfAll
              );
        if (outcome === 'success') {
          successCount++;
        } else if (outcome === 'error') {
          errorCount++;
        }
        // 'skip' counts as neither
      } catch (error) {
        CliUtils.error(
          `Error processing ${entry.path}: ${error instanceof Error ? error.message : String(error)}`
        );
        errorCount++;
      }
    }
  }

  return { successCount, errorCount };
}

type FileOutcome = 'success' | 'error' | 'skip';

async function encryptRegisteredFile(
  root: string,
  entry: RegisteredFile,
  passphrase: string
): Promise<FileOutcome> {
  const abs = path.join(root, entry.path);
  const encryptedPath = FileUtils.getEncryptedPath(abs);

  if (!(await FileUtils.fileExists(abs))) {
    if (await FileUtils.fileExists(encryptedPath)) {
      CliUtils.info(`${entry.path}: only the encrypted copy exists — skipping`);
    } else {
      CliUtils.warning(`${entry.path}: file not found — skipping`);
    }
    return 'skip';
  }

  // Idempotency: skip when the existing .gpg decrypts to identical content
  if (await FileUtils.fileExists(encryptedPath)) {
    const tempPath = `${abs}.temp.${Date.now()}`;
    try {
      const decryptResult = ExecUtils.decryptFile(
        encryptedPath,
        tempPath,
        passphrase
      );
      if (decryptResult.success) {
        const identical = await FileUtils.filesAreIdentical(abs, tempPath);
        if (await FileUtils.fileExists(tempPath)) {
          ExecUtils.removeFile(tempPath);
        }
        if (identical) {
          CliUtils.success(
            `${entry.path}: already encrypted with same content — skipping`
          );
          return 'success';
        }
        CliUtils.warning(
          `${entry.path}: has changes — updating encrypted version`
        );
      }
    } catch {
      if (await FileUtils.fileExists(tempPath)) {
        ExecUtils.removeFile(tempPath);
      }
    }
  }

  const result = ExecUtils.encryptFile(abs, passphrase);
  if (result.success) {
    CliUtils.success(`Encrypted: ${chalk.cyan(entry.path)}`);
    return 'success';
  }
  CliUtils.error(`Failed to encrypt ${entry.path}: ${result.message}`);
  return 'error';
}

async function decryptRegisteredFile(
  root: string,
  entry: RegisteredFile,
  passphrase: string,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  rawOptions: any,
  isPartOfAll?: boolean
): Promise<FileOutcome> {
  const abs = path.join(root, entry.path);
  const encryptedPath = FileUtils.getEncryptedPath(abs);

  if (!(await FileUtils.fileExists(encryptedPath))) {
    CliUtils.warning(`${entry.path}: no encrypted copy found — skipping`);
    return 'skip';
  }

  const plainExists = await FileUtils.fileExists(abs);
  if (plainExists && !rawOptions.overwrite && !isPartOfAll) {
    const confirm = await InteractiveUtils.confirmOperation(
      `Overwrite existing ${chalk.cyan(entry.path)}?`,
      false
    );
    if (!confirm) {
      CliUtils.info(`Skipped ${entry.path}.`);
      return 'skip';
    }
  }

  let backupPath: string | null = null;
  if (plainExists) {
    backupPath = await FileUtils.createBackup(abs);
  }

  const result = ExecUtils.decryptFile(encryptedPath, abs, passphrase);
  if (result.success) {
    if (backupPath) {
      await FileUtils.removeBackup(backupPath);
    }
    CliUtils.success(`Decrypted: ${chalk.cyan(entry.path)}`);
    return 'success';
  }

  if (backupPath) {
    ExecUtils.moveFile(backupPath, abs);
    CliUtils.info(`Restored original ${entry.path} from backup`);
  }
  CliUtils.error(`Failed to decrypt ${entry.path}: ${result.message}`);
  return 'error';
}

export async function executeFilesEncrypt(
  filePath: string | undefined,
  rawOptions: RawFilesOptions
): Promise<void> {
  await runFilesCrypto('encrypt', filePath, rawOptions);
}

export async function executeFilesDecrypt(
  filePath: string | undefined,
  rawOptions: RawFilesOptions
): Promise<void> {
  await runFilesCrypto('decrypt', filePath, rawOptions);
}

async function runFilesCrypto(
  mode: 'encrypt' | 'decrypt',
  filePath: string | undefined,
  rawOptions: RawFilesOptions
): Promise<void> {
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();

  CliUtils.header(
    mode === 'encrypt'
      ? 'Registered File Encryption'
      : 'Registered File Decryption'
  );

  // Dry-run needs no gpg — skip the guard so previews work anywhere
  if (!rawOptions.dryRun && !ExecUtils.isGpgAvailable()) {
    CliUtils.error('GPG is not available. Please install GPG.');
    InteractiveUtils.displayPrerequisites();
    process.exit(ExitCode.GPG_ERROR);
  }

  const { root, entries } = await FileUtils.getRegisteredFiles(cwd);

  let selected = entries;
  if (filePath) {
    const rel = FileUtils.rebaseToRoot(filePath, cwd, root);
    selected = entries.filter(e => e.path === rel);
    if (selected.length === 0) {
      throw new FilesError(
        `'${rel}' is not registered. Use "envx files add" first.`,
        ExitCode.INVALID_ARGS
      );
    }
  }

  if (selected.length === 0) {
    CliUtils.warning(
      'No files registered. Use "envx files add <path>" to register one.'
    );
    return;
  }

  if (rawOptions.dryRun) {
    CliUtils.info('Dry run — no files will be modified.');
  }

  const result = await processRegisteredFiles(selected, root, {
    mode,
    rawOptions,
  });

  console.log();
  if (result.successCount > 0) {
    CliUtils.success(`Successfully ${mode}ed ${result.successCount} file(s)`);
  }
  if (result.errorCount > 0) {
    CliUtils.error(`Failed to ${mode} ${result.errorCount} file(s)`);
    process.exit(ExitCode.GENERAL_ERROR);
  }
}
```

Also register the two subcommands inside `createFilesCommand()` (before `return files;`):

```typescript
files
  .command('encrypt [path]')
  .description('Encrypt registered files (all, or one by path)')
  .option('-p, --passphrase <passphrase>', 'Passphrase for encryption')
  .option('-s, --secret <secret>', 'Secret key from .envrc')
  .option('--dry-run', 'Show what would happen without making changes')
  .option('-c, --cwd <path>', 'Working directory path')
  .action(actionWrapper(executeFilesEncrypt, 'Files encrypt'));

files
  .command('decrypt [path]')
  .description('Decrypt registered files (all, or one by path)')
  .option('-p, --passphrase <passphrase>', 'Passphrase for decryption')
  .option('-s, --secret <secret>', 'Secret key from .envrc')
  .option('--overwrite', 'Overwrite existing files without confirmation')
  .option('--dry-run', 'Show what would happen without making changes')
  .option('-c, --cwd <path>', 'Working directory path')
  .action(actionWrapper(executeFilesDecrypt, 'Files decrypt'));
```

Note: `actionWrapper`'s loose typing accepts the optional-positional signature — commander passes `(path | undefined, options)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/core/files-engine.test.ts`
Expected: PASS (10 tests). Then `npm run test:core` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/files.ts __tests__/core/files-engine.test.ts
git commit -m "feat(files): processRegisteredFiles engine + files encrypt/decrypt"
```

---

### Task 5: Ride-along in `encrypt` and `decrypt`

**Files:**

- Modify: `src/commands/encrypt.ts`
- Modify: `src/commands/decrypt.ts`
- Test: `__tests__/core/files-ridealong.test.ts` (create)

**Interfaces:**

- Consumes: `processRegisteredFiles`, `FileUtils.getRegisteredFiles` (Tasks 2/4).
- Produces:
  - `executeEncrypt(rawOptions: any): Promise<void>` — newly **exported** from `encrypt.ts` (currently module-private).
  - `executeDecrypt(rawOptions: any): Promise<void>` — newly **exported** from `decrypt.ts`.
  - `processSingleEnvironment` in BOTH files returns `{ successCount: number; errorCount: number; passphrase: string }` (adds `passphrase`).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/core/files-ridealong.test.ts`:

```typescript
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { executeEncrypt } from '../../src/commands/encrypt';
import { executeDecrypt } from '../../src/commands/decrypt';
import { ExecUtils } from '../../src/utils/exec';
import { InteractiveUtils } from '../../src/utils/interactive';

describe('registered-files ride-along', () => {
  let tmpDir: string;
  let encryptSpy: jest.SpyInstance;
  let decryptSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-ride-'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), 'A=1\n');
    await fs.writeFile(
      path.join(tmpDir, '.envrc'),
      [
        'export PRODUCTION_SECRET="prod-pass"',
        'export FILES_SECRET="files-pass"',
        '',
      ].join('\n')
    );
    await fs.writeFile(path.join(tmpDir, 'gs.json'), '{}');
    await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'certdata');
    await fs.writeFile(
      path.join(tmpDir, '.envxrc'),
      JSON.stringify({
        files: [{ path: 'gs.json', stage: 'production' }, { path: 'cert.p12' }],
      })
    );

    jest.spyOn(ExecUtils, 'isGpgAvailable').mockReturnValue(true);
    jest
      .spyOn(ExecUtils, 'testGpgOperation')
      .mockReturnValue({ success: true, message: 'ok' });
    encryptSpy = jest
      .spyOn(ExecUtils, 'encryptFile')
      .mockImplementation((filePath: string) => {
        fs.writeFileSync(`${filePath}.gpg`, 'cipher');
        return { success: true, message: 'ok' };
      });
    decryptSpy = jest
      .spyOn(ExecUtils, 'decryptFile')
      .mockImplementation((enc: string, out: string) => {
        fs.writeFileSync(out, 'plain');
        return { success: true, message: 'ok' };
      });
    jest.spyOn(InteractiveUtils, 'confirmOperation').mockResolvedValue(true);
    jest
      .spyOn(InteractiveUtils, 'promptPassphrase')
      .mockResolvedValue('prompted');
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
    jest.restoreAllMocks();
  });

  it('encrypt -e production also encrypts the stage-bound file with the stage passphrase', async () => {
    await executeEncrypt({
      environment: 'production',
      cwd: tmpDir,
      overwrite: true,
    });

    expect(encryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, '.env.production'),
      'prod-pass'
    );
    expect(encryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'gs.json'),
      'prod-pass'
    );
    // Global file is NOT part of a single-stage encrypt
    expect(encryptSpy).not.toHaveBeenCalledWith(
      path.join(tmpDir, 'cert.p12'),
      expect.anything()
    );
  });

  it('encrypt --all also encrypts global files with FILES_SECRET', async () => {
    await executeEncrypt({ all: true, cwd: tmpDir, overwrite: true });

    expect(encryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'gs.json'),
      'prod-pass'
    );
    expect(encryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'cert.p12'),
      'files-pass'
    );
  });

  it('decrypt -e production also decrypts the stage-bound file', async () => {
    await fs.writeFile(path.join(tmpDir, '.env.production.gpg'), 'c');
    await fs.writeFile(path.join(tmpDir, 'gs.json.gpg'), 'c');

    await executeDecrypt({
      environment: 'production',
      cwd: tmpDir,
      overwrite: true,
    });

    expect(decryptSpy).toHaveBeenCalledWith(
      path.join(tmpDir, 'gs.json.gpg'),
      path.join(tmpDir, 'gs.json'),
      'prod-pass'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/core/files-ridealong.test.ts`
Expected: FAIL — `executeEncrypt` / `executeDecrypt` are not exported.

- [ ] **Step 3: Modify `src/commands/encrypt.ts`**

3a. Add imports:

```typescript
import { processRegisteredFiles } from './files';
```

3b. Export the orchestrator — change `async function executeEncrypt(` to:

```typescript
export async function executeEncrypt(rawOptions: any): Promise<void> {
```

3c. `processSingleEnvironment` — change the return type annotation and all three return statements to include the resolved passphrase:

```typescript
async function processSingleEnvironment(
  rawOptions: any,
  environment: string,
  cwd: string,
  isPartOfAll: boolean = false
): Promise<{ successCount: number; errorCount: number; passphrase: string }> {
```

- early return when no unencrypted files: `return { successCount: 0, errorCount: 0, passphrase };`
- dry-run return: `return { successCount: unencryptedFiles.length, errorCount: 0, passphrase };`
- interactive-selection empty return: `return { successCount: 0, errorCount: 0, passphrase };`
- cancelled-confirm return: `return { successCount: 0, errorCount: 0, passphrase };`
- final return: `return { successCount, errorCount, passphrase };`

(`encryptEnvironment`'s declared return type stays `{ successCount: number; errorCount: number }` — it returns the call result, which is a wider object; TypeScript allows that for non-literal returns.)

3d. In `executeEncrypt`, capture the result and add the ride-along at the end (replacing the bare `await processSingleEnvironment(rawOptions, environment, cwd);`):

```typescript
const envResult = await processSingleEnvironment(rawOptions, environment, cwd);

// Ride-along: encrypt files registered for this stage
const { root, entries } = await FileUtils.getRegisteredFiles(cwd);
const stageFiles = entries.filter(e => e.stage === environment);
if (stageFiles.length > 0) {
  console.log();
  CliUtils.subheader('Registered Files');
  const fileResult = await processRegisteredFiles(stageFiles, root, {
    mode: 'encrypt',
    rawOptions,
    passphraseOverride: envResult.passphrase,
  });
  if (fileResult.errorCount > 0) {
    process.exit(ExitCode.GENERAL_ERROR);
  }
}
```

3e. In `processAllEnvironments`, insert before the `// Final summary for all environments` block:

```typescript
// Ride-along: process ALL registered files (stage-bound + global)
const { root, entries } = await FileUtils.getRegisteredFiles(cwd);
if (entries.length > 0) {
  console.log();
  CliUtils.subheader('Registered Files');
  const fileResult = await processRegisteredFiles(entries, root, {
    mode: 'encrypt',
    rawOptions,
    isPartOfAll: true,
  });
  results.push({
    environment: 'registered files',
    success: fileResult.successCount,
    errors: fileResult.errorCount,
  });
  totalSuccess += fileResult.successCount;
  totalErrors += fileResult.errorCount;
}
```

- [ ] **Step 4: Modify `src/commands/decrypt.ts` — mirror of Step 3**

- Import `processRegisteredFiles` from `./files`.
- Export `executeDecrypt`.
- Add `passphrase` to `processSingleEnvironment`'s return type and every return statement — decrypt.ts has SIX return sites: no-encrypted-files early return, dry-run return, interactive-selection-empty return, conflict-overwrite-declined return, confirm-declined return, and the final return. Grep `return { successCount` in the file to catch them all.
- `executeDecrypt` single-stage ride-along — identical to 3d but `mode: 'decrypt'`.
- `processAllEnvironments` ride-along — identical to 3e but `mode: 'decrypt'`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/core/files-ridealong.test.ts`
Expected: PASS (3 tests).

Run: `npm run test:core`
Expected: PASS — existing encrypt/decrypt tests must not regress.

- [ ] **Step 6: Commit**

```bash
git add src/commands/encrypt.ts src/commands/decrypt.ts __tests__/core/files-ridealong.test.ts
git commit -m "feat(files): encrypt/decrypt ride-along for registered files"
```

---

### Task 6: `list` / `status` / `interactive` touches

**Files:**

- Modify: `src/index.ts` (`executeList`, `executeStatus`)
- Modify: `src/commands/interactive.ts` (`executeInteractive`)
- Test: append to `__tests__/core/files-ridealong.test.ts`

**Interfaces:**

- Consumes: `getRegisteredFileStatus` (Task 3), `FileUtils.getRegisteredFiles` (Task 2), `FileUtils.FILES_SECRET_NAME`, `FileUtils.generateRandomSecret`, `InteractiveUtils.confirmOperation` / `promptPassphrase`.
- Produces: no new exports — display/prompt behavior only.

- [ ] **Step 1: Write the failing test (interactive FILES_SECRET)**

Append to `__tests__/core/files-ridealong.test.ts`:

```typescript
describe('interactive FILES_SECRET step', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-inter-'));
    jest.spyOn(InteractiveUtils, 'displayWelcome').mockImplementation(() => {});
    jest.spyOn(InteractiveUtils, 'setupEnvrc').mockResolvedValue({});
    jest.spyOn(InteractiveUtils, 'confirmOperation').mockResolvedValue(true);
    jest
      .spyOn(InteractiveUtils, 'promptPassphrase')
      .mockResolvedValue('files-pass');
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
    jest.restoreAllMocks();
  });

  it('offers FILES_SECRET when a global file is registered', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.envxrc'),
      JSON.stringify({ files: [{ path: 'cert.p12' }] })
    );

    const { executeInteractive } = await import(
      '../../src/commands/interactive'
    );
    await executeInteractive({ cwd: tmpDir });

    const envrc = await fs.readFile(path.join(tmpDir, '.envrc'), 'utf-8');
    expect(envrc).toContain('export FILES_SECRET="files-pass"');
  });

  it('does not offer FILES_SECRET without global files', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.envxrc'),
      JSON.stringify({ files: [{ path: 'gs.json', stage: 'production' }] })
    );

    const { executeInteractive } = await import(
      '../../src/commands/interactive'
    );
    await executeInteractive({ cwd: tmpDir });

    const envrc = await fs.readFile(path.join(tmpDir, '.envrc'), 'utf-8');
    expect(envrc).not.toContain('FILES_SECRET');
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest __tests__/core/files-ridealong.test.ts -t 'FILES_SECRET'`
Expected: FAIL — `.envrc` lacks `FILES_SECRET` in the first test.

- [ ] **Step 3: Implement the `interactive` step**

In `src/commands/interactive.ts`, inside `executeInteractive`, directly after
`const envrcConfig = await InteractiveUtils.setupEnvrc(cwd, existingEnvironments);`
and before `const writeResult = await FileUtils.writeEnvrc(cwd, envrcConfig);`:

```typescript
// Offer FILES_SECRET when global registered files exist (spec §3)
const { entries: registeredFiles } = await FileUtils.getRegisteredFiles(cwd);
const hasGlobalFiles = registeredFiles.some(entry => !entry.stage);
if (hasGlobalFiles && !envrcConfig[FileUtils.FILES_SECRET_NAME]) {
  const setFilesSecret = await InteractiveUtils.confirmOperation(
    `Registered global files found. Set ${FileUtils.FILES_SECRET_NAME} for them?`,
    true
  );
  if (setFilesSecret) {
    envrcConfig[FileUtils.FILES_SECRET_NAME] = rawOptions.generate
      ? FileUtils.generateRandomSecret()
      : await InteractiveUtils.promptPassphrase(
          `Enter passphrase for ${FileUtils.FILES_SECRET_NAME}:`
        );
  }
}
```

- [ ] **Step 4: Implement `list` and `status` sections in `src/index.ts`**

4a. Add to the imports:

```typescript
import { getRegisteredFileStatus } from './commands/files';
```

(`createFilesCommand` is already imported from Task 3 — merge into one import statement.)

4b. At the end of `executeList` (after the `.envrc` status lines):

```typescript
// Registered files section
const { root: filesRoot, entries: registered } =
  await FileUtils.getRegisteredFiles(cwd);
if (registered.length > 0) {
  console.log();
  CliUtils.subheader('Registered Files');
  const fileRows: string[][] = [];
  for (const entry of registered) {
    const status = await getRegisteredFileStatus(filesRoot, entry);
    fileRows.push([
      chalk.cyan(entry.path),
      entry.stage
        ? CliUtils.formatEnvironment(entry.stage)
        : chalk.gray('global'),
      status.label,
    ]);
  }
  CliUtils.printTable(['Path', 'Stage', 'Status'], fileRows);
}
```

4c. In `executeStatus`, after the `.envrc` presence block (which ends with
`recommendations.push('Set up .envrc file with "envx interactive"');`) and
BEFORE the `// Security recommendations` block:

```typescript
// Registered files
const { root: filesRoot, entries: registered } =
  await FileUtils.getRegisteredFiles(cwd);
if (registered.length > 0) {
  let encryptedRegistered = 0;
  for (const entry of registered) {
    const status = await getRegisteredFileStatus(filesRoot, entry);
    if (status.enc) {
      encryptedRegistered++;
    }
    if (status.plain && !status.enc) {
      recommendations.push(`Encrypt registered file ${entry.path}`);
    }
  }
  console.log(
    `Registered files: ${chalk.cyan(registered.length)} (${chalk.green(encryptedRegistered)} encrypted)`
  );
}
```

- [ ] **Step 5: Run tests + build**

Run: `npx jest __tests__/core/files-ridealong.test.ts`
Expected: PASS (5 tests).

Run: `npm run test:core && npm run build`
Expected: PASS, clean compile.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/commands/interactive.ts __tests__/core/files-ridealong.test.ts
git commit -m "feat(files): list/status sections and interactive FILES_SECRET step"
```

---

### Task 7: Integration tests (real CLI, real GPG)

**Files:**

- Test: `__tests__/integration/files.test.ts` (create)

**Interfaces:**

- Consumes: the built CLI at `dist/index.js` (everything from Tasks 1–6).
- Produces: end-to-end coverage including a binary round-trip.

- [ ] **Step 1: Build first (integration gate)**

```bash
npm run build
```

- [ ] **Step 2: Write the integration tests**

Create `__tests__/integration/files.test.ts`:

```typescript
import crypto from 'crypto';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

const CLI = path.join(__dirname, '../../dist/index.js');

const run = (args: string, cwd: string): string =>
  execSync(`node "${CLI}" ${args}`, { cwd, encoding: 'utf-8' });

let hasGpg = true;
try {
  execSync('gpg --version', { stdio: 'pipe' });
} catch {
  hasGpg = false;
}
const gpgDescribe = hasGpg ? describe : describe.skip;

describe('envx files (integration)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-int-files-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('files add registers and updates .gitignore', async () => {
    await fs.ensureDir(path.join(tmpDir, 'certs'));
    await fs.writeFile(path.join(tmpDir, 'certs/signing.p12'), 'data');

    const out = run('files add certs/signing.p12', tmpDir);
    expect(out).toContain('Registered');

    const config = JSON.parse(
      await fs.readFile(path.join(tmpDir, '.envxrc'), 'utf-8')
    );
    expect(config.files).toEqual([{ path: 'certs/signing.p12' }]);

    const gitignore = await fs.readFile(
      path.join(tmpDir, '.gitignore'),
      'utf-8'
    );
    expect(gitignore).toContain('certs/signing.p12');
    expect(gitignore).toContain('!certs/signing.p12.gpg');
  });

  it('files list shows registered entries', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.json'), '{}');
    run('files add a.json -e production', tmpDir);

    const out = run('files list', tmpDir);
    expect(out).toContain('a.json');
    expect(out).toContain('production');
    expect(out).toContain('Unencrypted');
  });

  it('files remove unregisters', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.json'), '{}');
    run('files add a.json', tmpDir);
    run('files remove a.json', tmpDir);

    const config = JSON.parse(
      await fs.readFile(path.join(tmpDir, '.envxrc'), 'utf-8')
    );
    expect(config.files).toEqual([]);
  });

  it('files encrypt --dry-run reports without changing anything', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.json'), '{}');
    run('files add a.json', tmpDir);

    const out = run('files encrypt --dry-run -p test', tmpDir);
    expect(out).toContain('would encrypt');
    expect(await fs.pathExists(path.join(tmpDir, 'a.json.gpg'))).toBe(false);
  });

  gpgDescribe('with real gpg', () => {
    it('binary file round-trips through encrypt and decrypt', async () => {
      const binary = crypto.randomBytes(256);
      await fs.writeFile(path.join(tmpDir, 'keystore.p12'), binary);
      run('files add keystore.p12', tmpDir);

      run('files encrypt -p integration-pass', tmpDir);
      expect(await fs.pathExists(path.join(tmpDir, 'keystore.p12.gpg'))).toBe(
        true
      );

      await fs.remove(path.join(tmpDir, 'keystore.p12'));
      run('files decrypt -p integration-pass', tmpDir);

      const restored = await fs.readFile(path.join(tmpDir, 'keystore.p12'));
      expect(Buffer.compare(restored, binary)).toBe(0);
    });

    it('encrypt --all rides along registered files', async () => {
      await fs.writeFile(path.join(tmpDir, '.env.production'), 'A=1\n');
      await fs.writeFile(
        path.join(tmpDir, '.envrc'),
        [
          'export PRODUCTION_SECRET="prod-pass"',
          'export FILES_SECRET="files-pass"',
          '',
        ].join('\n')
      );
      await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'certdata');
      run('files add cert.p12', tmpDir);

      run('encrypt --all --overwrite', tmpDir);

      expect(
        await fs.pathExists(path.join(tmpDir, '.env.production.gpg'))
      ).toBe(true);
      expect(await fs.pathExists(path.join(tmpDir, 'cert.p12.gpg'))).toBe(true);
    });

    it('list shows registered files with encryption status', async () => {
      await fs.writeFile(path.join(tmpDir, '.env.production'), 'A=1\n');
      await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'certdata');
      run('files add cert.p12', tmpDir);
      run('files encrypt -p pass', tmpDir);

      const out = run('list', tmpDir);
      expect(out).toContain('Registered Files');
      expect(out).toContain('cert.p12');
    });
  });
});
```

- [ ] **Step 3: Run the integration tests**

Run: `npm run build && npx jest __tests__/integration/files.test.ts`
Expected: PASS (7 tests; 3 skipped if gpg is unavailable).

- [ ] **Step 4: Full suite**

Run: `npm run build && npm test && npm run lint && npm run format:check`
Expected: everything green (lint may show the pre-existing `no-explicit-any` warnings — warnings are OK, errors are not).

- [ ] **Step 5: Commit**

```bash
git add __tests__/integration/files.test.ts
git commit -m "test(files): integration coverage incl. binary round-trip"
```

---

### Task 8: Documentation sync

**Files:**

- Modify: `README.md`
- Modify: `CLAUDE.md`
- Create: `docs/project/commands/features/feature-files.md`
- Modify: `docs/project/commands/commands.md`
- Modify: `docs/project/changes-log.md`

**Interfaces:** none — docs only. Content must describe the implemented behavior exactly (verify against the code, not from memory).

- [ ] **Step 1: README.md**

Add `envx files` to the Commands ToC and insert a command section after `### envx run` following the established format: usage examples (`files add/remove/list/encrypt/decrypt`), the flags table, the stage-bound vs global distinction, `FILES_SECRET`, ride-along behavior, and a note in the `.envxrc` field table:

```markdown
| `files` | `Array<{path, stage?}>` | Registered secret files (root-relative paths). Stage-bound files join `encrypt/decrypt -e <stage>`; global files use `FILES_SECRET`. Managed via `envx files add/remove/list`. |
```

Also add `FILES_SECRET` to the Secret Variable Naming section.

- [ ] **Step 2: CLAUDE.md**

- Commands list: add `**files**` — registry management + engine, ride-along semantics, `FILES_SECRET` convention.
- `.envxrc` field list: add `files: Array<{path, stage?}>`.
- Note the new exports: `executeEncrypt`/`executeDecrypt` now exported; `processSingleEnvironment` returns `passphrase`.

- [ ] **Step 3: docs/project sync (project-docs-sync change-tracking)**

- Create `docs/project/commands/features/feature-files.md` in the same format as the sibling feature docs (frontmatter, Summary, Usage, Flags, Behavior, Edge cases table, Exit codes, Related, Changelog) describing the implemented command.
- Add a `files` row to the command inventory table in `docs/project/commands/commands.md` and a note in the `--all` matrix section that registered files ride along.
- Append a changes-log entry to `docs/project/changes-log.md` (newest at top) with change type `additive`, listing the rewritten docs and the spec/plan paths.

- [ ] **Step 4: Verify docs**

Run: `npx prettier --check "README.md" "CLAUDE.md" "docs/project/**/*.md"`
Expected: clean (run `npx prettier --write` on failures).

Check every relative link added to docs/project resolves.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md docs/project
git commit -m "docs(files): document envx files across README, CLAUDE.md, docs/project"
```

---

## Final verification (after all tasks)

```bash
npm run build && npm test && npm run lint && npm run format:check
```

Expected: full suite green. Then review the diff end-to-end (`git diff main...HEAD --stat`) and hand off per superpowers:finishing-a-development-branch.

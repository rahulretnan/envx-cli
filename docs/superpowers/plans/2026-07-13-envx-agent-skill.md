# envx Agent Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Agent Skills–standard `SKILL.md` that teaches AI coding agents how to use envx, installable via a new `envx skill add/remove` command and offered during `envx init`.

**Architecture:** A static markdown template at `skills/envx/SKILL.md` (repo root) is the single source of truth — shipped in the npm package and discoverable by the skills.sh CLI (`npx skills add rahulretnan/envx-cli`). A new `src/commands/skill.ts` copies it into `.agents/skills/envx/SKILL.md` (always) plus agent dirs detected at the project root (`.claude`, `.cursor`, `.codex`). `executeInit` gains one confirm prompt that calls the same install function.

**Tech Stack:** TypeScript (strict), Commander.js, fs-extra, Zod, Jest/ts-jest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-13-envx-agent-skill-design.md`

## Global Constraints

- TypeScript strict mode; single quotes, semicolons, trailing commas (es5), 2-space indent, 80-char lines (Prettier enforced).
- Command files export `createXxxCommand(): Command` plus `executeXxx()` functions; `execute*` take `rawOptions: any` (pre-existing `no-explicit-any` warnings are accepted in `commands/`).
- Copies, not symlinks (Windows-safe).
- No `.envxrc` changes, no `.gitignore` changes — installed skill files are meant to be committed.
- Integration tests exec `dist/index.js`, so run `npm run build` before `npm run test:integration` or full `npm test`.
- Commander converts dashed flags to camelCase on the options object (`--force` → `force`); variadic `--agent a b` → `agent: ['a', 'b']`.

---

### Task 1: Bundled SKILL.md template

**Files:**

- Create: `skills/envx/SKILL.md`
- Modify: `package.json` (the `files` array, lines 52–56)
- Test: `__tests__/core/skill.test.ts`

**Interfaces:**

- Produces: `skills/envx/SKILL.md` at the repo root — Task 2's `resolveSkillTemplate()` resolves it via `path.resolve(__dirname, '..', '..', 'skills', 'envx', 'SKILL.md')` from both `src/commands/` and `dist/commands/`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/core/skill.test.ts`:

```typescript
import fs from 'fs-extra';
import path from 'path';

const TEMPLATE_PATH = path.resolve(__dirname, '../../skills/envx/SKILL.md');

describe('skill template', () => {
  it('exists and has Agent Skills frontmatter', async () => {
    const content = await fs.readFile(TEMPLATE_PATH, 'utf-8');
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/^name: envx$/m);
    expect(match![1]).toMatch(/^description:/m);
  });

  it('covers the core workflows and safety rules', async () => {
    const content = await fs.readFile(TEMPLATE_PATH, 'utf-8');
    expect(content).toContain('envx decrypt --all');
    expect(content).toContain('envx run');
    expect(content).toContain('envx files add');
    expect(content).toContain('.envrc');
    expect(content).toContain('NEVER');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/core/skill.test.ts`
Expected: FAIL — `ENOENT ... skills/envx/SKILL.md`

- [ ] **Step 3: Create the template**

Create `skills/envx/SKILL.md` with exactly this content:

````markdown
---
name: envx
description: >-
  Use when working in a project that manages secrets with envx (envx-cli):
  .env.<stage> files, .env.<stage>.gpg encrypted files, an .envrc passphrase
  file, an .envxrc JSON config, or registered secret files (certs, keystores,
  service-account JSON). Covers encrypting/decrypting env files, running
  commands with injected secrets, managing secret files, and safety rules
  for handling plaintext secrets.
---

# envx — encrypted environment and secret files

envx encrypts `.env.<stage>` files and registered secret files with GPG.
Encrypted `*.gpg` artifacts are committed to git; plaintext never is.

## Key files

| File                    | Purpose                                                                 | Committed?                           |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| `.envrc`                | Passphrases: `export <STAGE>_SECRET="..."`, `export FILES_SECRET="..."` | **Never.** Never print its contents. |
| `.envxrc`               | JSON project config: `environments`, `ignore`, `excludeDirs`, `files`   | Yes                                  |
| `.env.<stage>`          | Plaintext env file (e.g. `.env.production`)                             | Never                                |
| `.env.<stage>.gpg`      | Encrypted env file                                                      | Yes                                  |
| Registered secret files | Paths listed in `.envxrc` `files` (plaintext)                           | Never (their `.gpg` siblings: yes)   |

## Discover state first

Do not assume which environments or secret files exist. Ask envx:

```bash
envx status        # encryption status + recommendations
envx list          # every env file, encrypted or not
envx config show   # .envxrc: environments, ignore patterns, files registry
envx files list    # registered secret files
```

Commands work from any subdirectory — envx finds `.envrc`/`.envxrc` by
walking upward to the project root (monorepo-safe).

## Core workflows

**Fresh clone / missing plaintext files:**

```bash
envx decrypt --all          # decrypt every environment + registered files
```

**After editing a plaintext env or registered secret file, re-encrypt and
commit only the `.gpg`:**

```bash
envx encrypt -e <stage>     # one environment (+ its stage-bound files)
envx encrypt --all          # everything
```

**Run a command with secrets injected in memory (nothing written to disk):**

```bash
envx run -e production -- npm start
envx run -e staging --env DEBUG=true -- npm test
```

Prefer `envx run` over decrypting to disk when a process just needs the
variables.

**Manage arbitrary secret files (service-account JSON, certs, keystores):**

```bash
envx files add path/to/secret.json                 # global (FILES_SECRET)
envx files add google-services.json -e production  # stage-bound
envx files encrypt
envx files decrypt
```

**New environment:**

```bash
envx create -e staging     # then edit it, then: envx encrypt -e staging
```

## Safety rules

- NEVER commit or print plaintext secrets (`.env.<stage>`, registered
  files, `.envrc`). When asked about config, show variable NAMES only.
- NEVER edit `.gpg` files directly — edit the plaintext, then re-encrypt.
- NEVER delete or rewrite `.envrc`; it may hold the only copy of the
  passphrases.
- NEVER invent, hardcode, or relocate passphrases. They come from `.envrc`
  (`<STAGE>_SECRET` / `FILES_SECRET`) or from the user.
- If decryption fails on a passphrase, ask the user — do not guess.

## Command reference

| Command                                      | Purpose                                                               |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `envx init`                                  | First-run setup: discover envs, write `.envxrc`/`.gitignore`, secrets |
| `envx encrypt -e <stage>` / `--all`          | Encrypt env files (registered files ride along)                       |
| `envx decrypt -e <stage>` / `--all`          | Decrypt env files (registered files ride along)                       |
| `envx run -e <stage> -- <cmd>`               | Run command with decrypted vars in memory                             |
| `envx create -e <stage>`                     | Create a new `.env.<stage>` file                                      |
| `envx copy -e <stage>`                       | Copy a stage file to plain `.env`                                     |
| `envx files add/remove/list/encrypt/decrypt` | Manage registered secret files                                        |
| `envx config show/ignore/exclude/reset`      | Manage `.envxrc`                                                      |
| `envx list` / `envx status`                  | Inspect project state                                                 |
| `envx interactive`                           | Guided secret setup for `.envrc`                                      |
| `envx skill add/remove`                      | Install/remove this skill                                             |

Useful flags everywhere: `--dry-run` (preview), `--overwrite`,
`-c/--cwd <path>`.
````

- [ ] **Step 4: Add `skills/**/\*` to the published files\*\*

In `package.json`, change:

```json
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ],
```

to:

```json
  "files": [
    "dist/**/*",
    "skills/**/*",
    "README.md",
    "LICENSE"
  ],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/core/skill.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add skills/envx/SKILL.md package.json __tests__/core/skill.test.ts
git commit -m "feat(skill): add bundled agent SKILL.md template"
```

---

### Task 2: `executeSkillAdd` — install engine

**Files:**

- Modify: `src/types/index.ts` (append interface)
- Modify: `src/schemas/index.ts` (append schema + validator)
- Create: `src/commands/skill.ts`
- Test: `__tests__/core/skill.test.ts` (extend)

**Interfaces:**

- Consumes: `skills/envx/SKILL.md` (Task 1); `FileUtils.findProjectRoot(cwd): Promise<string | null>`, `FileUtils.ensureDir(dirPath)`, `FileUtils.getRelativePath(absolutePath, cwd)` from `src/utils/file.ts`; `CliUtils.header/success/info/warning` and `ExecUtils.getCurrentDir()` from `src/utils/exec.ts`.
- Produces: `executeSkillAdd(rawOptions: any): Promise<void>`, `resolveSkillTemplate(): string`, `AGENT_TARGETS: Record<string, string>` exported from `src/commands/skill.ts`; `SkillOptions` in types; `SKILL_AGENTS`, `skillOptionsSchema`, `validateSkillOptions(options: unknown)` in schemas. Tasks 3–5 rely on these exact names.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/core/skill.test.ts` (add the new imports to the top of the file):

```typescript
import os from 'os';
import { executeSkillAdd } from '../../src/commands/skill';
```

```typescript
describe('envx skill add', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-skill-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  const canonical = () => path.join(tmpDir, '.agents/skills/envx/SKILL.md');

  it('always writes the canonical .agents copy', async () => {
    await executeSkillAdd({ cwd: tmpDir });

    const template = await fs.readFile(TEMPLATE_PATH, 'utf-8');
    expect(await fs.readFile(canonical(), 'utf-8')).toBe(template);
  });

  it('copies into detected agent dirs', async () => {
    await fs.ensureDir(path.join(tmpDir, '.claude'));

    await executeSkillAdd({ cwd: tmpDir });

    expect(
      await fs.pathExists(path.join(tmpDir, '.claude/skills/envx/SKILL.md'))
    ).toBe(true);
    expect(
      await fs.pathExists(path.join(tmpDir, '.cursor/skills/envx/SKILL.md'))
    ).toBe(false);
  });

  it('--agent overrides detection', async () => {
    await fs.ensureDir(path.join(tmpDir, '.claude'));

    await executeSkillAdd({ cwd: tmpDir, agent: ['cursor'] });

    expect(
      await fs.pathExists(path.join(tmpDir, '.cursor/skills/envx/SKILL.md'))
    ).toBe(true);
    expect(
      await fs.pathExists(path.join(tmpDir, '.claude/skills/envx/SKILL.md'))
    ).toBe(false);
    expect(await fs.pathExists(canonical())).toBe(true);
  });

  it('is idempotent on re-run', async () => {
    await executeSkillAdd({ cwd: tmpDir });
    await executeSkillAdd({ cwd: tmpDir });

    const template = await fs.readFile(TEMPLATE_PATH, 'utf-8');
    expect(await fs.readFile(canonical(), 'utf-8')).toBe(template);
  });

  it('preserves local edits unless --force', async () => {
    await executeSkillAdd({ cwd: tmpDir });
    await fs.writeFile(canonical(), 'locally edited');

    await executeSkillAdd({ cwd: tmpDir });
    expect(await fs.readFile(canonical(), 'utf-8')).toBe('locally edited');

    await executeSkillAdd({ cwd: tmpDir, force: true });
    const template = await fs.readFile(TEMPLATE_PATH, 'utf-8');
    expect(await fs.readFile(canonical(), 'utf-8')).toBe(template);
  });

  it('rejects unknown agent names', async () => {
    await expect(
      executeSkillAdd({ cwd: tmpDir, agent: ['vscode'] })
    ).rejects.toThrow(/Invalid skill options/);
  });

  it('installs at the project root when run from a subdirectory', async () => {
    await fs.ensureDir(path.join(tmpDir, '.git'));
    const sub = path.join(tmpDir, 'packages/app');
    await fs.ensureDir(sub);

    await executeSkillAdd({ cwd: sub });

    expect(await fs.pathExists(canonical())).toBe(true);
    expect(
      await fs.pathExists(path.join(sub, '.agents/skills/envx/SKILL.md'))
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/core/skill.test.ts`
Expected: FAIL — `Cannot find module '../../src/commands/skill'`

- [ ] **Step 3: Add the `SkillOptions` type**

Append to `src/types/index.ts`:

```typescript
export interface SkillOptions {
  cwd?: string;
  agent?: string[];
  force?: boolean;
}
```

- [ ] **Step 4: Add the schema and validator**

Append to `src/schemas/index.ts` (it already imports `z` from `zod`):

```typescript
export const SKILL_AGENTS = ['agents', 'claude', 'cursor', 'codex'] as const;

export const skillOptionsSchema = z.object({
  cwd: z.string().optional(),
  agent: z.array(z.enum(SKILL_AGENTS)).optional(),
  force: z.boolean().optional(),
});

export function validateSkillOptions(
  options: unknown
): z.infer<typeof skillOptionsSchema> {
  const result = skillOptionsSchema.safeParse(options);
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `${i.path.join('.') || 'options'}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid skill options — ${issues}`);
  }
  return result.data;
}
```

- [ ] **Step 5: Implement `src/commands/skill.ts`**

```typescript
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { validateSkillOptions } from '../schemas';
import { ExitCode } from '../types';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';

// Install locations per supported agent, relative to the project root.
// 'agents' is the universal Agent Skills location and is always written.
export const AGENT_TARGETS: Record<string, string> = {
  agents: '.agents/skills/envx/SKILL.md',
  claude: '.claude/skills/envx/SKILL.md',
  cursor: '.cursor/skills/envx/SKILL.md',
  codex: '.codex/skills/envx/SKILL.md',
};

// Agent dirs whose presence at the project root triggers auto-install.
const DETECT_DIRS: Record<string, string> = {
  claude: '.claude',
  cursor: '.cursor',
  codex: '.codex',
};

export function resolveSkillTemplate(): string {
  // skill.ts lives in src/commands/ (dev) or dist/commands/ (published);
  // the template sits two levels up in both layouts.
  const candidate = path.resolve(
    __dirname,
    '..',
    '..',
    'skills',
    'envx',
    'SKILL.md'
  );
  if (!fs.existsSync(candidate)) {
    throw new Error('Bundled skill template not found (skills/envx/SKILL.md).');
  }
  return candidate;
}

export async function executeSkillAdd(rawOptions: any): Promise<void> {
  const options = validateSkillOptions(rawOptions);
  const cwd = options.cwd || ExecUtils.getCurrentDir();
  const root = (await FileUtils.findProjectRoot(cwd)) ?? cwd;

  const template = await fs.readFile(resolveSkillTemplate(), 'utf-8');

  const targets = new Set<string>(['agents']);
  if (options.agent && options.agent.length > 0) {
    options.agent.forEach(agent => targets.add(agent));
  } else {
    for (const [agent, dir] of Object.entries(DETECT_DIRS)) {
      if (await fs.pathExists(path.join(root, dir))) {
        targets.add(agent);
      }
    }
  }

  CliUtils.header('Installing envx agent skill');

  for (const agent of targets) {
    const target = path.join(root, AGENT_TARGETS[agent]);
    const rel = FileUtils.getRelativePath(target, root);

    if (await fs.pathExists(target)) {
      const existing = await fs.readFile(target, 'utf-8');
      if (existing === template) {
        CliUtils.info(`${rel} — already up to date`);
        continue;
      }
      if (!options.force) {
        CliUtils.warning(
          `${rel} — has local changes, skipping (use --force to overwrite)`
        );
        continue;
      }
    }

    await FileUtils.ensureDir(path.dirname(target));
    await fs.writeFile(target, template);
    CliUtils.success(`${rel} — installed`);
  }

  console.log();
  CliUtils.info(
    'Commit the installed SKILL.md files so agents on every machine get them.'
  );
}
```

(`Command` and `ExitCode` are unused until Task 3 adds `createSkillCommand` — if ESLint complains at this step, leave the imports off and add them in Task 3.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest __tests__/core/skill.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/schemas/index.ts src/commands/skill.ts __tests__/core/skill.test.ts
git commit -m "feat(skill): executeSkillAdd installs SKILL.md to universal + detected agent dirs"
```

---

### Task 3: `executeSkillRemove` + `createSkillCommand` + registration

**Files:**

- Modify: `src/commands/skill.ts`
- Modify: `src/index.ts` (imports around line 6–20; `program.addCommand` block around line 52–59)
- Test: `__tests__/core/skill.test.ts` (extend)

**Interfaces:**

- Consumes: `AGENT_TARGETS`, `validateSkillOptions`, `executeSkillAdd` (Task 2).
- Produces: `executeSkillRemove(rawOptions: any): Promise<void>` and `createSkillCommand(): Command` exported from `src/commands/skill.ts`; `envx skill add|remove` registered on the program. Task 4 imports `executeSkillAdd` in `src/index.ts`; Task 5 execs `skill add` via the CLI.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/core/skill.test.ts` (extend the existing import from `../../src/commands/skill` with `executeSkillRemove`):

```typescript
describe('envx skill remove', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-skillrm-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('removes every installed copy', async () => {
    await fs.ensureDir(path.join(tmpDir, '.claude'));
    await executeSkillAdd({ cwd: tmpDir });

    await executeSkillRemove({ cwd: tmpDir });

    expect(await fs.pathExists(path.join(tmpDir, '.agents/skills/envx'))).toBe(
      false
    );
    expect(await fs.pathExists(path.join(tmpDir, '.claude/skills/envx'))).toBe(
      false
    );
  });

  it('is a no-op when nothing is installed', async () => {
    await expect(executeSkillRemove({ cwd: tmpDir })).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/core/skill.test.ts`
Expected: FAIL — `executeSkillRemove` is not exported

- [ ] **Step 3: Implement remove + command factory**

Append to `src/commands/skill.ts`:

```typescript
export async function executeSkillRemove(rawOptions: any): Promise<void> {
  const options = validateSkillOptions(rawOptions);
  const cwd = options.cwd || ExecUtils.getCurrentDir();
  const root = (await FileUtils.findProjectRoot(cwd)) ?? cwd;

  let removed = 0;
  for (const relPath of Object.values(AGENT_TARGETS)) {
    // Remove the whole skills/envx dir, not just SKILL.md.
    const skillDir = path.dirname(path.join(root, relPath));
    if (await fs.pathExists(skillDir)) {
      await fs.remove(skillDir);
      CliUtils.success(`Removed ${FileUtils.getRelativePath(skillDir, root)}`);
      removed++;
    }
  }

  if (removed === 0) {
    CliUtils.info('No envx skill installations found.');
  }
}

export const createSkillCommand = (): Command => {
  const skill = new Command('skill');

  skill.description('Manage the envx agent skill for AI coding agents');

  skill
    .command('add')
    .description(
      'Install SKILL.md for AI agents (.agents + detected agent dirs)'
    )
    .option(
      '-a, --agent <agents...>',
      'Target agents explicitly: agents, claude, cursor, codex'
    )
    .option('-f, --force', 'Overwrite locally modified copies')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeSkillAdd(options);
      } catch (error) {
        CliUtils.error(
          `Skill add failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  skill
    .command('remove')
    .description('Remove all installed copies of the envx agent skill')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeSkillRemove(options);
      } catch (error) {
        CliUtils.error(
          `Skill remove failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  return skill;
};
```

- [ ] **Step 4: Register the command in `src/index.ts`**

Add to the imports (after the `createRunCommand` import):

```typescript
import { createSkillCommand, executeSkillAdd } from './commands/skill';
```

Add after `program.addCommand(createFilesCommand());`:

```typescript
program.addCommand(createSkillCommand());
```

(`executeSkillAdd` becomes used in Task 4; if ESLint flags it as unused at this step, import only `createSkillCommand` now and extend the import in Task 4.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/core/skill.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: Commit**

```bash
git add src/commands/skill.ts src/index.ts __tests__/core/skill.test.ts
git commit -m "feat(skill): add envx skill add/remove command"
```

---

### Task 4: `envx init` offers the skill install

**Files:**

- Modify: `src/index.ts` (`executeInit`, after the `.gitignore` block ending around line 434; export list at line 533)
- Test: `__tests__/core/skill.test.ts` (extend)

**Interfaces:**

- Consumes: `executeSkillAdd` (Task 2), `InteractiveUtils.confirmOperation(message: string, defaultValue?: boolean): Promise<boolean>`.
- Produces: `executeInit` exported from `src/index.ts` (previously private) — mirrors the existing precedent of exporting `executeEncrypt`/`executeDecrypt` for tests.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/core/skill.test.ts` (new imports at the top of the file):

```typescript
import { executeInit } from '../../src/index';
import { ExecUtils } from '../../src/utils/exec';
import { InteractiveUtils } from '../../src/utils/interactive';
```

```typescript
describe('envx init skill prompt', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-initskill-'));
    jest.spyOn(ExecUtils, 'isGpgAvailable').mockReturnValue(true);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
    jest.restoreAllMocks();
  });

  it('installs the skill when the user confirms', async () => {
    jest
      .spyOn(InteractiveUtils, 'confirmOperation')
      .mockImplementation(async message => message.includes('agent skill'));

    await executeInit({ cwd: tmpDir });

    expect(
      await fs.pathExists(path.join(tmpDir, '.agents/skills/envx/SKILL.md'))
    ).toBe(true);
  });

  it('skips the skill when the user declines', async () => {
    jest.spyOn(InteractiveUtils, 'confirmOperation').mockResolvedValue(false);

    await executeInit({ cwd: tmpDir });

    expect(await fs.pathExists(path.join(tmpDir, '.agents'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/core/skill.test.ts`
Expected: FAIL — `executeInit` is not exported from `src/index` (TS error) or the skill file is never created.

- [ ] **Step 3: Implement the init hook**

In `src/index.ts`, inside `executeInit`, insert immediately after the `.gitignore` result block (after the `else { CliUtils.warning(...) }` that ends around line 434) and before `await showQuickStart(cwd);`:

```typescript
// Offer to install the agent skill for AI coding agents
console.log();
const installSkill = await InteractiveUtils.confirmOperation(
  'Install the envx agent skill for AI coding agents (Claude Code, Cursor, Codex)?',
  true
);

if (installSkill) {
  try {
    await executeSkillAdd({ cwd: options.cwd });
  } catch (error) {
    CliUtils.warning(
      `Could not install agent skill: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

Then change the export at the bottom of `src/index.ts` from:

```typescript
export { createProgram };
```

to:

```typescript
export { createProgram, executeInit };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/core/skill.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Run the full core suite to catch regressions**

Run: `npm run test:core`
Expected: PASS (no existing test asserts on init's prompt sequence, but verify)

- [ ] **Step 6: Commit**

```bash
git add src/index.ts __tests__/core/skill.test.ts
git commit -m "feat(init): offer agent skill install during envx init"
```

---

### Task 5: Integration tests against the built CLI

**Files:**

- Modify: `__tests__/integration/cli.test.ts` (add a describe block; uses the existing `runCli` helper and `testDir`)

**Interfaces:**

- Consumes: `envx skill add/remove` CLI (Task 3); the existing `runCli(command)` helper in `cli.test.ts` which execs `node dist/index.js <command>` inside `testDir`.

- [ ] **Step 1: Build so dist is current**

Run: `npm run build`
Expected: exit 0, `dist/commands/skill.js` exists

- [ ] **Step 2: Write the integration tests**

Add to `__tests__/integration/cli.test.ts`, alongside the other top-level describes:

```typescript
describe('Skill Command', () => {
  it('should install the skill into .agents and detected agent dirs', async () => {
    await fs.ensureDir(path.join(testDir, '.claude'));

    const result = runCli('skill add');

    expect(result.code).toBe(0);
    expect(
      await fs.pathExists(path.join(testDir, '.agents/skills/envx/SKILL.md'))
    ).toBe(true);
    expect(
      await fs.pathExists(path.join(testDir, '.claude/skills/envx/SKILL.md'))
    ).toBe(true);
  });

  it('should remove installed skill copies', async () => {
    runCli('skill add');

    const result = runCli('skill remove');

    expect(result.code).toBe(0);
    expect(
      await fs.pathExists(path.join(testDir, '.agents/skills/envx/SKILL.md'))
    ).toBe(false);
  });

  it('should list skill in help output', () => {
    const result = runCli('--help');

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('skill');
  });
});
```

- [ ] **Step 3: Run the integration suite**

Run: `npm run test:integration`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add __tests__/integration/cli.test.ts
git commit -m "test(skill): integration coverage for skill add/remove"
```

---

### Task 6: Documentation sync + final verification

**Files:**

- Modify: `README.md` (Features list ~line 65; Commands section — add `### envx skill` after the `envx files` section; Table of Contents ~line 8)
- Modify: `CLAUDE.md` (Command Pattern list; Configuration Files notes)
- Modify: `docs/project/commands/commands.md` (append a skill command section in that file's existing format)
- Modify: `docs/project/changes-log.md` (append an entry dated 2026-07-13)

**Interfaces:**

- Consumes: final CLI behavior from Tasks 1–5. No code.

- [ ] **Step 1: README**

Add a Features bullet (match the existing bullet style):

```markdown
- 🤖 **AI agent skill**: `envx skill add` installs a SKILL.md that teaches AI coding agents (Claude Code, Cursor, Codex) the envx workflow
```

Add this section under Commands, after the `envx files` section, and add a matching Table of Contents entry:

````markdown
### `envx skill`

Install an Agent Skills–standard `SKILL.md` that teaches AI coding agents
(Claude Code, Cursor, Codex — any agent that reads the format) how to use
envx safely in this project: the decrypt → edit → encrypt loop, `envx run`,
the files registry, and rules against committing or printing plaintext.

```bash
# Install: writes .agents/skills/envx/SKILL.md plus copies into
# agent dirs detected at the project root (.claude, .cursor, .codex)
envx skill add

# Target specific agents explicitly
envx skill add --agent claude cursor

# Overwrite locally edited copies
envx skill add --force

# Remove all installed copies
envx skill remove
```

Locally edited copies are never overwritten without `--force`. Commit the
installed files so every agent (and teammate) gets them. `envx init` offers
this install during project setup.

The same skill is installable without envx via the skills.sh ecosystem:

```bash
npx skills add rahulretnan/envx-cli
```
````

- [ ] **Step 2: CLAUDE.md**

Add to the command list in the Command Pattern section:

```markdown
- **`skill`** — Install/remove the bundled AI-agent skill. `skill add [--agent <names...>] [--force]` copies `skills/envx/SKILL.md` (the template at the repo root, shipped via package.json `files`) to `.agents/skills/envx/SKILL.md` plus detected `.claude`/`.cursor`/`.codex` dirs at the project root; locally edited copies are skipped without `--force`. `skill remove` deletes all copies. `init` offers the install after the `.gitignore` step. `executeInit` is now exported from `src/index.ts` for tests.
```

- [ ] **Step 3: docs/project sync**

Read `docs/project/commands/commands.md` and append an `envx skill` section matching its existing per-command format (purpose, subcommands `add`/`remove`, flags `--agent`, `--force`, `--cwd`, install locations, idempotency behavior, init integration). Append a `2026-07-13` entry to `docs/project/changes-log.md` following its existing entry format, covering: new `skills/envx/SKILL.md` template, new `src/commands/skill.ts`, init prompt, `executeInit` export, package.json `files` addition.

- [ ] **Step 4: Full verification**

Run:

```bash
npm run build && npm test && npm run lint && npm run format:check
```

Expected: all pass (pre-existing `no-explicit-any` warnings in `commands/` are acceptable; zero errors).

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md docs/project/commands/commands.md docs/project/changes-log.md
git commit -m "docs: document envx skill command and agent skill install"
```

- [ ] **Step 6: Post-merge follow-up (note, not code)**

After this lands on `main`, verify the skills.sh channel once from a scratch directory: `npx skills add rahulretnan/envx-cli` should discover `skills/envx/SKILL.md`. If the CLI expects a different layout, adjust the template path (and `resolveSkillTemplate`, `package.json` `files`, docs) keeping a single source of truth.

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { executeSkillAdd, executeSkillRemove } from '../../src/commands/skill';
import * as skillCommand from '../../src/commands/skill';
import { executeInit } from '../../src/index';
import { ExecUtils } from '../../src/utils/exec';
import { InteractiveUtils } from '../../src/utils/interactive';

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

  it('treats a CRLF checkout of an identical file as up to date', async () => {
    await executeSkillAdd({ cwd: tmpDir });
    const lf = await fs.readFile(canonical(), 'utf-8');
    await fs.writeFile(canonical(), lf.replace(/\n/g, '\r\n'));

    await executeSkillAdd({ cwd: tmpDir });

    const after = await fs.readFile(canonical(), 'utf-8');
    expect(after).toContain('\r\n');
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

  it('warns but does not fail init when the skill install throws', async () => {
    jest
      .spyOn(InteractiveUtils, 'confirmOperation')
      .mockImplementation(async message => message.includes('agent skill'));
    jest
      .spyOn(skillCommand, 'executeSkillAdd')
      .mockRejectedValue(new Error('boom'));

    await expect(executeInit({ cwd: tmpDir })).resolves.not.toThrow();

    expect(
      await fs.pathExists(path.join(tmpDir, '.agents/skills/envx/SKILL.md'))
    ).toBe(false);
  });
});

import fs from 'fs-extra';
import path from 'path';
import { Command } from 'commander';
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

const normalizeEol = (s: string): string => s.replace(/\r\n/g, '\n');

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
      if (normalizeEol(existing) === normalizeEol(template)) {
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

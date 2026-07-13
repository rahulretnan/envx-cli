import fs from 'fs-extra';
import path from 'path';
import { validateSkillOptions } from '../schemas';
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

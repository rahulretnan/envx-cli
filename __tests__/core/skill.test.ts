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

import { execSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { ExecUtils } from '../../src/utils/exec';

let hasGit = true;
try {
  execSync('git --version', { stdio: 'pipe' });
} catch {
  hasGit = false;
}
const d = hasGit ? describe : describe.skip;

d('ExecUtils.isPathTrackedByGit', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-git-'));
    execSync('git init -q', { cwd: tmpDir });
    execSync('git config user.email t@t.t && git config user.name t', {
      cwd: tmpDir,
    });
  });
  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('returns true for a tracked file', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.txt'), 'x');
    execSync('git add a.txt', { cwd: tmpDir });
    expect(ExecUtils.isPathTrackedByGit('a.txt', tmpDir)).toBe(true);
  });

  it('returns false for an untracked file', async () => {
    await fs.writeFile(path.join(tmpDir, 'b.txt'), 'x');
    expect(ExecUtils.isPathTrackedByGit('b.txt', tmpDir)).toBe(false);
  });

  it('returns false when there is no git repo', async () => {
    const noRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-nogit-'));
    try {
      // still inside a parent repo? use a path with no repo above by testing status!==0
      expect(ExecUtils.isPathTrackedByGit('whatever.txt', noRepo)).toBe(false);
    } finally {
      await fs.remove(noRepo);
    }
  });

  it('does not execute injected shell commands in the filename', () => {
    const marker = path.join(tmpDir, 'PWNED');
    // A filename containing shell metacharacters must be treated as a literal
    // argument, not a command. The call must not create the marker file.
    ExecUtils.isPathTrackedByGit(`x"; touch "${marker}`, tmpDir);
    expect(fs.existsSync(marker)).toBe(false);
  });
});

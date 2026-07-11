import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { executeFilesAdd, executeFilesRemove } from '../../src/commands/files';
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

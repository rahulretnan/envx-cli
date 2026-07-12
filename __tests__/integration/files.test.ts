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

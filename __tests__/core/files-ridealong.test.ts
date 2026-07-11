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

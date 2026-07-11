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

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { executeEncrypt } from '../../src/commands/encrypt';
import { executeDecrypt } from '../../src/commands/decrypt';
import {
  executeFilesAdd,
  processRegisteredFiles,
} from '../../src/commands/files';
import { registeredFileSchema } from '../../src/schemas';
import { CliUtils, ExecUtils } from '../../src/utils/exec';
import { FileUtils } from '../../src/utils/file';
import { InteractiveUtils } from '../../src/utils/interactive';

describe('review fixes', () => {
  let tmpDir: string;
  let encryptSpy: jest.SpyInstance;
  let decryptSpy: jest.SpyInstance;
  let confirmSpy: jest.SpyInstance;
  let promptSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-fixes-'));

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
    confirmSpy = jest
      .spyOn(InteractiveUtils, 'confirmOperation')
      .mockResolvedValue(true);
    promptSpy = jest
      .spyOn(InteractiveUtils, 'promptPassphrase')
      .mockResolvedValue('prompted');
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
    jest.restoreAllMocks();
  });

  describe('cancellation halts ride-along', () => {
    beforeEach(async () => {
      await fs.writeFile(path.join(tmpDir, '.env.production'), 'A=1\n');
      await fs.writeFile(
        path.join(tmpDir, '.envrc'),
        'export PRODUCTION_SECRET="prod-pass"\n'
      );
      await fs.writeFile(path.join(tmpDir, 'gs.json'), '{}');
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({ files: [{ path: 'gs.json', stage: 'production' }] })
      );
    });

    it('declined encrypt confirm does not encrypt registered files', async () => {
      confirmSpy.mockResolvedValue(false);

      await executeEncrypt({ environment: 'production', cwd: tmpDir });

      expect(encryptSpy).not.toHaveBeenCalled();
    });

    it('declined decrypt confirm does not decrypt registered files', async () => {
      await fs.writeFile(path.join(tmpDir, '.env.production.gpg'), 'c');
      await fs.writeFile(path.join(tmpDir, 'gs.json.gpg'), 'c');
      await fs.remove(path.join(tmpDir, '.env.production'));
      confirmSpy.mockResolvedValue(false);

      await executeDecrypt({ environment: 'production', cwd: tmpDir });

      expect(decryptSpy).not.toHaveBeenCalled();
    });
  });

  describe('files-only projects (no .env.*)', () => {
    beforeEach(async () => {
      await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'certdata');
      await fs.writeFile(
        path.join(tmpDir, '.envrc'),
        'export FILES_SECRET="files-pass"\n'
      );
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({ files: [{ path: 'cert.p12' }] })
      );
    });

    it('encrypt --all still processes registered files', async () => {
      await executeEncrypt({ all: true, cwd: tmpDir });

      expect(encryptSpy).toHaveBeenCalledWith(
        path.join(tmpDir, 'cert.p12'),
        'files-pass'
      );
    });

    it('decrypt --all still processes registered files', async () => {
      await fs.writeFile(path.join(tmpDir, 'cert.p12.gpg'), 'c');
      await executeDecrypt({ all: true, cwd: tmpDir, overwrite: true });

      expect(decryptSpy).toHaveBeenCalledWith(
        path.join(tmpDir, 'cert.p12.gpg'),
        path.join(tmpDir, 'cert.p12'),
        'files-pass'
      );
    });

    it('encrypt without --all points at files encrypt', async () => {
      const infoSpy = jest.spyOn(CliUtils, 'info');

      await executeEncrypt({ cwd: tmpDir });

      expect(encryptSpy).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('envx files encrypt')
      );
    });
  });

  describe('--all reuses stage passphrases (no re-prompt)', () => {
    it('prompted stage secret is reused for that stage registered file', async () => {
      // No .envrc at all — the stage passphrase must be prompted exactly
      // once and reused for the stage-bound registered file.
      await fs.writeFile(path.join(tmpDir, '.env.production'), 'A=1\n');
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({ files: [{ path: 'gs.json', stage: 'production' }] })
      );
      await fs.writeFile(path.join(tmpDir, 'gs.json'), '{}');

      await executeEncrypt({ all: true, cwd: tmpDir });

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(encryptSpy).toHaveBeenCalledWith(
        path.join(tmpDir, 'gs.json'),
        'prompted'
      );
    });
  });

  describe('idempotency decrypt failure', () => {
    it('warns before re-encrypting over an undecryptable .gpg', async () => {
      const warnSpy = jest.spyOn(CliUtils, 'warning');
      await fs.writeFile(path.join(tmpDir, '.envrc'), '');
      await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'data');
      await fs.writeFile(path.join(tmpDir, 'cert.p12.gpg'), 'oldcipher');
      decryptSpy.mockReturnValue({ success: false, message: 'bad pass' });

      await processRegisteredFiles([{ path: 'cert.p12' }], tmpDir, {
        mode: 'encrypt',
        rawOptions: { passphrase: 'new-pass' },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('could not decrypt existing encrypted copy')
      );
      expect(encryptSpy).toHaveBeenCalled();
    });
  });

  describe('tmpdir isolation for temp and backup files', () => {
    it('idempotency temp file never appears next to the registered file', async () => {
      await fs.writeFile(path.join(tmpDir, '.envrc'), '');
      await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'data');
      await fs.writeFile(path.join(tmpDir, 'cert.p12.gpg'), 'oldcipher');
      // decrypt writes the temp wherever it is told to
      decryptSpy.mockImplementation((enc: string, out: string) => {
        fs.writeFileSync(out, 'other');
        expect(out.startsWith(os.tmpdir())).toBe(true);
        return { success: true, message: 'ok' };
      });

      await processRegisteredFiles([{ path: 'cert.p12' }], tmpDir, {
        mode: 'encrypt',
        rawOptions: { passphrase: 'p' },
      });

      const leftovers = (await fs.readdir(tmpDir)).filter(
        f => f.includes('.temp.') || f.includes('.backup.')
      );
      expect(leftovers).toEqual([]);
    });

    it('decrypt backup lives in tmpdir and restores on failure', async () => {
      await fs.writeFile(path.join(tmpDir, '.envrc'), '');
      await fs.writeFile(path.join(tmpDir, 'cert.p12'), 'original');
      await fs.writeFile(path.join(tmpDir, 'cert.p12.gpg'), 'cipher');
      decryptSpy.mockImplementation((enc: string, out: string) => {
        fs.writeFileSync(out, 'corrupt');
        return { success: false, message: 'bad pass' };
      });

      const result = await processRegisteredFiles(
        [{ path: 'cert.p12' }],
        tmpDir,
        { mode: 'decrypt', rawOptions: { passphrase: 'p', overwrite: true } }
      );

      expect(result.errorCount).toBe(1);
      // original restored, no backup sibling left in the project dir
      expect(await fs.readFile(path.join(tmpDir, 'cert.p12'), 'utf-8')).toBe(
        'original'
      );
      const leftovers = (await fs.readdir(tmpDir)).filter(f =>
        f.includes('.backup.')
      );
      expect(leftovers).toEqual([]);
    });
  });

  describe('dry-run reports missing files as skips', () => {
    it('does not count a missing plaintext as would-encrypt', async () => {
      await fs.writeFile(path.join(tmpDir, '.envrc'), '');
      const result = await processRegisteredFiles(
        [{ path: 'missing.p12' }],
        tmpDir,
        { mode: 'encrypt', rawOptions: { dryRun: true } }
      );

      expect(result).toEqual({ successCount: 0, errorCount: 0 });
    });
  });

  describe('config reset preserves project state', () => {
    it('keeps files and environments, resets ignore/excludeDirs', async () => {
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({
          ignore: ['custom'],
          excludeDirs: ['out'],
          environments: ['production'],
          files: [{ path: 'cert.p12' }],
        })
      );

      const { createProgram } = await import('../../src/index');
      void createProgram; // config reset is exercised via its executor below
      const configModule = await import('../../src/commands/config');
      // executeConfigReset is module-private; drive it through the command
      const command = configModule.createConfigCommand();
      const reset = command.commands.find(c => c.name() === 'reset');
      expect(reset).toBeDefined();
      await reset!.parseAsync(['--cwd', tmpDir], { from: 'user' });

      const config = JSON.parse(
        await fs.readFile(path.join(tmpDir, '.envxrc'), 'utf-8')
      );
      expect(config.ignore).toEqual(FileUtils.DEFAULT_IGNORE_PATTERNS);
      expect(config.excludeDirs).toEqual(FileUtils.DEFAULT_EXCLUDE_DIRS);
      expect(config.environments).toEqual(['production']);
      expect(config.files).toEqual([{ path: 'cert.p12' }]);
    });
  });

  describe('path handling tightening', () => {
    it('rebaseToRoot accepts names starting with ..', () => {
      expect(FileUtils.rebaseToRoot('..archive/key.p12', tmpDir, tmpDir)).toBe(
        '..archive/key.p12'
      );
    });

    it('rebaseToRoot still rejects real escapes', () => {
      expect(() =>
        FileUtils.rebaseToRoot('../outside.p12', tmpDir, tmpDir)
      ).toThrow(/project root/);
    });

    it('schema rejects uppercase .GPG and drive-relative paths', () => {
      expect(() =>
        registeredFileSchema.parse({ path: 'secret.GPG' })
      ).toThrow();
      expect(() =>
        registeredFileSchema.parse({ path: 'C:secret.json' })
      ).toThrow();
    });
  });

  describe('.gitignore section handling', () => {
    it('repeated adds do not duplicate the # EnvX files header', async () => {
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      await FileUtils.addFilesToGitignore(tmpDir, ['b.json']);

      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content.match(/^# EnvX files$/gm)).toHaveLength(1);
      expect(content.match(/^a\.json$/gm)).toHaveLength(1);
      expect(content.match(/^b\.json$/gm)).toHaveLength(1);
    });

    it('files add warns when a parent ignore rule defeats the negation', async () => {
      const { execSync } = await import('child_process');
      let hasGit = true;
      try {
        execSync('git --version', { stdio: 'pipe' });
      } catch {
        hasGit = false;
      }
      if (!hasGit) {
        return; // environment without git — covered by CI machines that have it
      }

      execSync('git init -q', { cwd: tmpDir });
      await fs.writeFile(path.join(tmpDir, '.gitignore'), 'certs/\n');
      await fs.ensureDir(path.join(tmpDir, 'certs'));
      await fs.writeFile(path.join(tmpDir, 'certs/signing.p12'), 'x');

      const warnSpy = jest.spyOn(CliUtils, 'warning');
      await executeFilesAdd('certs/signing.p12', { cwd: tmpDir });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('still ignored by git')
      );
    });
  });

  describe('invalid .envxrc warning', () => {
    it('warns instead of silently returning defaults', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await fs.writeFile(path.join(tmpDir, '.envxrc'), '{ not json');

      const config = await FileUtils.readEnvxrc(tmpDir);

      expect(config).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is invalid')
      );
    });
  });
});

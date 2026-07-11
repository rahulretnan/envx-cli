import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { FileUtils } from '../../src/utils/file';

describe('FileUtils registered-files helpers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-files-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  describe('FILES_SECRET_NAME', () => {
    it('is FILES_SECRET', () => {
      expect(FileUtils.FILES_SECRET_NAME).toBe('FILES_SECRET');
    });
  });

  describe('rebaseToRoot', () => {
    it('returns the path unchanged when cwd is the root', () => {
      expect(FileUtils.rebaseToRoot('certs/a.p12', tmpDir, tmpDir)).toBe(
        'certs/a.p12'
      );
    });

    it('re-bases a path given from a subdirectory', () => {
      const sub = path.join(tmpDir, 'packages', 'app');
      expect(FileUtils.rebaseToRoot('a.p12', sub, tmpDir)).toBe(
        'packages/app/a.p12'
      );
    });

    it('accepts an absolute path inside the root', () => {
      expect(
        FileUtils.rebaseToRoot(path.join(tmpDir, 'x.json'), tmpDir, tmpDir)
      ).toBe('x.json');
    });

    it('throws when the path escapes the root', () => {
      expect(() =>
        FileUtils.rebaseToRoot('../outside.json', tmpDir, tmpDir)
      ).toThrow(/project root/);
    });

    it('throws when the path IS the root', () => {
      expect(() => FileUtils.rebaseToRoot('.', tmpDir, tmpDir)).toThrow();
    });
  });

  describe('getRegisteredFiles', () => {
    it('returns empty entries with cwd root when no .envxrc exists', async () => {
      const result = await FileUtils.getRegisteredFiles(tmpDir);
      expect(result).toEqual({ root: tmpDir, entries: [] });
    });

    it('returns entries from .envxrc', async () => {
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({
          files: [
            { path: 'certs/signing.p12' },
            { path: 'android/google-services.json', stage: 'production' },
          ],
        })
      );
      const result = await FileUtils.getRegisteredFiles(tmpDir);
      expect(result.root).toBe(tmpDir);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].path).toBe('certs/signing.p12');
    });

    it('walks upward from a subdirectory', async () => {
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({ files: [{ path: 'a.json' }] })
      );
      const sub = path.join(tmpDir, 'packages', 'app');
      await fs.ensureDir(sub);
      const result = await FileUtils.getRegisteredFiles(sub);
      expect(result.root).toBe(tmpDir);
      expect(result.entries).toHaveLength(1);
    });

    it('returns empty entries when .envxrc has no files field', async () => {
      await fs.writeFile(
        path.join(tmpDir, '.envxrc'),
        JSON.stringify({ ignore: ['example'] })
      );
      const result = await FileUtils.getRegisteredFiles(tmpDir);
      expect(result.entries).toEqual([]);
    });
  });

  describe('addFilesToGitignore', () => {
    it('creates .gitignore with an EnvX files section', async () => {
      const result = await FileUtils.addFilesToGitignore(tmpDir, [
        'certs/signing.p12',
      ]);
      expect(result.success).toBe(true);
      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content).toContain('# EnvX files');
      expect(content).toContain('certs/signing.p12');
      expect(content).toContain('!certs/signing.p12.gpg');
    });

    it('is idempotent', async () => {
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content.match(/^a\.json$/gm)).toHaveLength(1);
      expect(content.match(/^!a\.json\.gpg$/gm)).toHaveLength(1);
    });

    it('adds the plaintext line even when only the negated .gpg line exists', async () => {
      // substring trap: "!a.json.gpg" contains "a.json"
      await fs.writeFile(path.join(tmpDir, '.gitignore'), '!a.json.gpg\n');
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content.match(/^a\.json$/gm)).toHaveLength(1);
    });

    it('preserves existing content', async () => {
      await fs.writeFile(path.join(tmpDir, '.gitignore'), 'node_modules\n');
      await FileUtils.addFilesToGitignore(tmpDir, ['a.json']);
      const content = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf-8'
      );
      expect(content).toContain('node_modules');
      expect(content).toContain('a.json');
    });
  });
});

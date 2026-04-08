// chalk is ESM-only (v5). Mock it so Jest (CJS mode) can load exec.ts.
jest.mock('chalk', () => ({
  default: {
    blue: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    cyan: Object.assign((s: string) => s, {
      bold: { cyan: (s: string) => s },
    }),
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
    }),
    magenta: (s: string) => s,
  },
}));

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { ExecUtils } from '../../src/utils/exec';
import { FileUtils } from '../../src/utils/file';

describe('FileUtils Core Operations', () => {
  describe('generateRandomSecret', () => {
    it('should generate secret of default length', () => {
      const secret = FileUtils.generateRandomSecret();

      expect(secret).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate secret of specified length', () => {
      const secret = FileUtils.generateRandomSecret(16);

      expect(secret).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate different secrets each time', () => {
      const secret1 = FileUtils.generateRandomSecret();
      const secret2 = FileUtils.generateRandomSecret();

      expect(secret1).not.toBe(secret2);
    });

    it('should generate hex-encoded secrets', () => {
      const secret = FileUtils.generateRandomSecret(4);
      expect(secret).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe('generateSecretVariableName', () => {
    it('should generate correct variable name', () => {
      const result = FileUtils.generateSecretVariableName('production');
      expect(result).toBe('PRODUCTION_SECRET');
    });

    it('should handle mixed case input', () => {
      const result = FileUtils.generateSecretVariableName('ProDucTion');
      expect(result).toBe('PRODUCTION_SECRET');
    });

    it('should handle special characters', () => {
      const result = FileUtils.generateSecretVariableName('test-env_123');
      expect(result).toBe('TEST-ENV_123_SECRET');
    });

    it('should handle lowercase input', () => {
      const result = FileUtils.generateSecretVariableName('development');
      expect(result).toBe('DEVELOPMENT_SECRET');
    });
  });

  describe('isValidEnvironmentName', () => {
    it('should accept valid environment names', () => {
      expect(FileUtils.isValidEnvironmentName('development')).toBe(true);
      expect(FileUtils.isValidEnvironmentName('test-env')).toBe(true);
      expect(FileUtils.isValidEnvironmentName('prod_123')).toBe(true);
      expect(FileUtils.isValidEnvironmentName('env123')).toBe(true);
      expect(FileUtils.isValidEnvironmentName('LOCAL')).toBe(true);
    });

    it('should reject invalid environment names', () => {
      expect(FileUtils.isValidEnvironmentName('')).toBe(false);
      expect(FileUtils.isValidEnvironmentName('test env')).toBe(false);
      expect(FileUtils.isValidEnvironmentName('test@env')).toBe(false);
      expect(FileUtils.isValidEnvironmentName('test.env')).toBe(false);
      expect(FileUtils.isValidEnvironmentName('test/env')).toBe(false);
    });

    it('should reject names with special characters', () => {
      expect(FileUtils.isValidEnvironmentName('env$test')).toBe(false);
      expect(FileUtils.isValidEnvironmentName('env!test')).toBe(false);
      expect(FileUtils.isValidEnvironmentName('env#test')).toBe(false);
      expect(FileUtils.isValidEnvironmentName('env%test')).toBe(false);
    });
  });

  describe('path utilities', () => {
    it('should get encrypted path correctly', () => {
      const result = FileUtils.getEncryptedPath('/test/.env.production');
      expect(result).toBe('/test/.env.production.gpg');
    });

    it('should get encrypted path for relative paths', () => {
      const result = FileUtils.getEncryptedPath('.env.development');
      expect(result).toBe('.env.development.gpg');
    });

    it('should get decrypted path correctly', () => {
      const result = FileUtils.getDecryptedPath('/test/.env.production.gpg');
      expect(result).toBe('/test/.env.production');
    });

    it('should get decrypted path for relative paths', () => {
      const result = FileUtils.getDecryptedPath('.env.staging.gpg');
      expect(result).toBe('.env.staging');
    });

    it('should identify encrypted files', () => {
      expect(FileUtils.isEncryptedFile('.env.production.gpg')).toBe(true);
      expect(FileUtils.isEncryptedFile('/path/.env.production.gpg')).toBe(true);
    });

    it('should identify non-encrypted files', () => {
      expect(FileUtils.isEncryptedFile('.env.production')).toBe(false);
      expect(FileUtils.isEncryptedFile('/path/.env.production')).toBe(false);
    });

    it('should get relative path correctly', () => {
      const result = FileUtils.getRelativePath(
        '/base/path/to/file.txt',
        '/base'
      );
      expect(result).toBe('path/to/file.txt');
    });

    it('should handle same directory paths', () => {
      const result = FileUtils.getRelativePath('/base/file.txt', '/base');
      expect(result).toBe('file.txt');
    });

    it('should handle current directory', () => {
      const result = FileUtils.getRelativePath('/base', '/base');
      expect(result).toBe('');
    });
  });

  describe('path manipulation edge cases', () => {
    it('should handle empty paths', () => {
      expect(FileUtils.getEncryptedPath('')).toBe('.gpg');
      expect(FileUtils.getDecryptedPath('.gpg')).toBe('');
    });

    it('should handle paths without extensions', () => {
      expect(FileUtils.getEncryptedPath('envfile')).toBe('envfile.gpg');
      expect(FileUtils.isEncryptedFile('envfile')).toBe(false);
    });

    it('should handle multiple .gpg extensions', () => {
      expect(FileUtils.getDecryptedPath('file.gpg.gpg')).toBe('file.gpg');
      expect(FileUtils.isEncryptedFile('file.gpg.gpg')).toBe(true);
    });

    it('should handle Windows-style paths', () => {
      const windowsPath = 'C:\\project\\.env.production';
      expect(FileUtils.getEncryptedPath(windowsPath)).toBe(
        'C:\\project\\.env.production.gpg'
      );
    });
  });

  describe('environment name validation edge cases', () => {
    it('should handle single character names', () => {
      expect(FileUtils.isValidEnvironmentName('a')).toBe(true);
      expect(FileUtils.isValidEnvironmentName('1')).toBe(true);
      expect(FileUtils.isValidEnvironmentName('-')).toBe(true);
      expect(FileUtils.isValidEnvironmentName('_')).toBe(true);
    });

    it('should handle very long names', () => {
      const longName = 'a'.repeat(100);
      expect(FileUtils.isValidEnvironmentName(longName)).toBe(true);
    });

    it('should handle names starting with numbers', () => {
      expect(FileUtils.isValidEnvironmentName('123env')).toBe(true);
    });

    it('should handle names starting with special characters', () => {
      expect(FileUtils.isValidEnvironmentName('-env')).toBe(true);
      expect(FileUtils.isValidEnvironmentName('_env')).toBe(true);
    });
  });

  describe('secret variable name generation edge cases', () => {
    it('should handle empty input', () => {
      const result = FileUtils.generateSecretVariableName('');
      expect(result).toBe('_SECRET');
    });

    it('should handle numeric input', () => {
      const result = FileUtils.generateSecretVariableName('123');
      expect(result).toBe('123_SECRET');
    });

    it('should handle input with multiple separators', () => {
      const result = FileUtils.generateSecretVariableName('test-env_name');
      expect(result).toBe('TEST-ENV_NAME_SECRET');
    });

    it('should preserve original casing patterns', () => {
      const result = FileUtils.generateSecretVariableName('CamelCase');
      expect(result).toBe('CAMELCASE_SECRET');
    });
  });

  describe('relative path calculation edge cases', () => {
    it('should handle identical paths', () => {
      const result = FileUtils.getRelativePath('/same/path', '/same/path');
      expect(result).toBe('');
    });

    it('should handle nested paths', () => {
      const result = FileUtils.getRelativePath(
        '/base/very/deep/nested/file.txt',
        '/base'
      );
      expect(result).toBe('very/deep/nested/file.txt');
    });

    it('should handle parent directory paths', () => {
      const result = FileUtils.getRelativePath('/base/file.txt', '/base/sub');
      expect(result).toBe('../file.txt');
    });

    it('should handle completely different paths', () => {
      const result = FileUtils.getRelativePath('/other/path', '/base');
      expect(result).toBe('../other/path');
    });
  });

  describe('file extension handling', () => {
    it('should handle files with no extension', () => {
      expect(FileUtils.isEncryptedFile('README')).toBe(false);
      expect(FileUtils.getEncryptedPath('README')).toBe('README.gpg');
    });

    it('should handle files with multiple extensions', () => {
      expect(FileUtils.isEncryptedFile('.env.local.backup.gpg')).toBe(true);
      expect(FileUtils.getDecryptedPath('.env.local.backup.gpg')).toBe(
        '.env.local.backup'
      );
    });

    it('should handle hidden files', () => {
      expect(FileUtils.isEncryptedFile('.hidden.gpg')).toBe(true);
      expect(FileUtils.getEncryptedPath('.hidden')).toBe('.hidden.gpg');
    });
  });

  describe('updateGitignore', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-test-'));
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('should create new .gitignore with EnvX patterns', async () => {
      const result = await FileUtils.updateGitignore(tempDir);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'Successfully updated .gitignore with Environment files and EnvX secrets patterns'
      );

      const gitignorePath = path.join(tempDir, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');

      expect(content).toContain('# Environment files');
      expect(content).toContain('.env.*');
      expect(content).toContain('!.env.example');
      expect(content).toContain('!.env.*.gpg');
      expect(content).toContain('# EnvX secrets');
      expect(content).toContain('.envrc');
      expect(content).toContain('.envxrc');
    });

    it('should append to existing .gitignore', async () => {
      const gitignorePath = path.join(tempDir, '.gitignore');
      const existingContent = '# Existing content\nnode_modules/\n*.log';
      await fs.writeFile(gitignorePath, existingContent, 'utf-8');

      const result = await FileUtils.updateGitignore(tempDir);

      expect(result.success).toBe(true);

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toContain('# Existing content');
      expect(content).toContain('node_modules/');
      expect(content).toContain('# Environment files');
      expect(content).toContain('.envrc');
    });

    it('should only add missing patterns', async () => {
      const gitignorePath = path.join(tempDir, '.gitignore');
      const existingContent = '# Existing content\n.env.*\n!.env.example';
      await fs.writeFile(gitignorePath, existingContent, 'utf-8');

      const result = await FileUtils.updateGitignore(tempDir);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'Successfully updated .gitignore with Environment files and EnvX secrets patterns'
      );

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toContain('# Existing content');
      expect(content).toContain('.env.*');
      expect(content).toContain('!.env.example');
      expect(content).toContain('!.env.*.gpg');
      expect(content).toContain('# EnvX secrets');
      expect(content).toContain('.envrc');

      // Should only have one occurrence of .env.* and !.env.example
      expect((content.match(/^\.env\.\*$/gm) || []).length).toBe(1);
      expect((content.match(/^!\.env\.example$/gm) || []).length).toBe(1);
    });

    it('should add only environment patterns when secrets exist', async () => {
      const gitignorePath = path.join(tempDir, '.gitignore');
      const existingContent = '# Existing\n.envrc\n.envxrc';
      await fs.writeFile(gitignorePath, existingContent, 'utf-8');

      const result = await FileUtils.updateGitignore(tempDir);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        'Successfully updated .gitignore with Environment files patterns'
      );

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toContain('# Environment files');
      expect(content).toContain('.env.*');
      expect(content).toContain('!.env.example');
      expect(content).toContain('!.env.*.gpg');
      expect(content).toContain('.envrc');
      expect(content).toContain('.envxrc');

      // Should not duplicate .envrc or add another EnvX secrets section
      expect((content.match(/\.envrc\b/g) || []).length).toBe(1);
      expect((content.match(/# EnvX secrets/g) || []).length).toBe(0);
    });

    it('should not update when all patterns exist', async () => {
      const gitignorePath = path.join(tempDir, '.gitignore');
      const existingContent =
        'node_modules/\n.env.*\n!.env.example\n!.env.*.gpg\n.envrc\n.envxrc';
      await fs.writeFile(gitignorePath, existingContent, 'utf-8');

      const result = await FileUtils.updateGitignore(tempDir);

      expect(result.success).toBe(true);
      expect(result.message).toBe(
        '.gitignore already contains all EnvX patterns'
      );

      const content = await fs.readFile(gitignorePath, 'utf-8');
      expect(content).toBe(existingContent);
    });

    it('should handle file system errors gracefully', async () => {
      // Try to write to a non-existent directory path
      const invalidPath = path.join(tempDir, 'non-existent', 'deep', 'path');

      const result = await FileUtils.updateGitignore(invalidPath);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to update .gitignore:');
      expect(result.error).toBeDefined();
    });
  });

  describe('resolveStageFile', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-resolve-'));
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('should return null when neither plain nor encrypted exists', async () => {
      const result = await FileUtils.resolveStageFile('production', tempDir);
      expect(result).toBeNull();
    });

    it('should return the plain file when only plain exists', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), 'FOO=bar');
      const result = await FileUtils.resolveStageFile('production', tempDir);
      expect(result).toEqual({
        path: path.join(tempDir, '.env.production'),
        encrypted: false,
      });
    });

    it('should return the encrypted file when only encrypted exists', async () => {
      await fs.writeFile(
        path.join(tempDir, '.env.production.gpg'),
        'ciphertext'
      );
      const result = await FileUtils.resolveStageFile('production', tempDir);
      expect(result).toEqual({
        path: path.join(tempDir, '.env.production.gpg'),
        encrypted: true,
      });
    });

    it('should prefer encrypted when both exist (encrypted wins)', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), 'FOO=plain');
      await fs.writeFile(
        path.join(tempDir, '.env.production.gpg'),
        'ciphertext'
      );
      const result = await FileUtils.resolveStageFile('production', tempDir);
      expect(result).toEqual({
        path: path.join(tempDir, '.env.production.gpg'),
        encrypted: true,
      });
    });

    it('should only look in cwd and ignore files in subdirectories', async () => {
      const subDir = path.join(tempDir, 'apps', 'web');
      await fs.ensureDir(subDir);
      await fs.writeFile(path.join(subDir, '.env.production'), 'FOO=nested');
      const result = await FileUtils.resolveStageFile('production', tempDir);
      expect(result).toBeNull();
    });

    // On case-insensitive macOS volumes, `FileUtils.fileExists('.env.Production')`
    // may return true when asked for `.env.production`. Skip this assertion on
    // non-Linux so CI stays green on macOS dev machines.
    const caseIt = process.platform === 'linux' ? it : it.skip;
    caseIt('should be case-sensitive on stage name (linux only)', async () => {
      await fs.writeFile(path.join(tempDir, '.env.Production'), 'FOO=cap');
      const result = await FileUtils.resolveStageFile('production', tempDir);
      expect(result).toBeNull();
    });
  });

  describe('parseEnvContent', () => {
    it('should parse simple KEY=VALUE lines', () => {
      const result = FileUtils.parseEnvContent('FOO=bar\nBAZ=qux');
      expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });

    it('should strip surrounding double quotes', () => {
      const result = FileUtils.parseEnvContent('FOO="hello world"');
      expect(result).toEqual({ FOO: 'hello world' });
    });

    it('should ignore comment lines', () => {
      const result = FileUtils.parseEnvContent('# a comment\nFOO=bar');
      expect(result).toEqual({ FOO: 'bar' });
    });

    it('should expand ${VAR} references to keys defined earlier in the same content', () => {
      const result = FileUtils.parseEnvContent(
        'HOST=db.example.com\nURL=postgres://${HOST}/app'
      );
      expect(result.URL).toBe('postgres://db.example.com/app');
    });

    it('should expand ${VAR} references against process.env', () => {
      process.env.__ENVX_TEST_EXPAND__ = 'found';
      try {
        const result = FileUtils.parseEnvContent(
          'VALUE=${__ENVX_TEST_EXPAND__}-suffix'
        );
        expect(result.VALUE).toBe('found-suffix');
      } finally {
        delete process.env.__ENVX_TEST_EXPAND__;
      }
    });

    it('should support ${VAR:-default} default syntax', () => {
      const result = FileUtils.parseEnvContent(
        'VALUE=${__ENVX_DEFINITELY_UNSET__:-fallback}'
      );
      expect(result.VALUE).toBe('fallback');
    });

    it('should NOT mutate process.env', () => {
      const beforeKeys = Object.keys(process.env).sort();
      FileUtils.parseEnvContent('__ENVX_SHOULD_NOT_LEAK__=oops');
      const afterKeys = Object.keys(process.env).sort();
      expect(afterKeys).toEqual(beforeKeys);
      expect(process.env.__ENVX_SHOULD_NOT_LEAK__).toBeUndefined();
    });

    it('should return empty object for empty content', () => {
      expect(FileUtils.parseEnvContent('')).toEqual({});
    });

    it('should allow empty values', () => {
      expect(FileUtils.parseEnvContent('FOO=')).toEqual({ FOO: '' });
    });
  });

  describe('loadEnvSource', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-load-'));
      jest.restoreAllMocks();
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('should load and parse a plain file', async () => {
      const filePath = path.join(tempDir, 'plain.env');
      await fs.writeFile(filePath, 'FOO=bar\nBAZ=qux');

      const result = await FileUtils.loadEnvSource({
        path: filePath,
        encrypted: false,
      });

      expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });

    it('should decrypt and parse an encrypted file using the provided passphrase', async () => {
      const filePath = path.join(tempDir, 'secret.env.gpg');
      await fs.writeFile(filePath, 'ciphertext'); // content irrelevant — decrypt is mocked

      const decryptSpy = jest
        .spyOn(ExecUtils, 'decryptFileToString')
        .mockReturnValue({
          success: true,
          content: 'SECRET=s3cret\nOTHER=val',
        });

      const result = await FileUtils.loadEnvSource(
        { path: filePath, encrypted: true },
        'my-passphrase'
      );

      expect(decryptSpy).toHaveBeenCalledWith(filePath, 'my-passphrase');
      expect(result).toEqual({ SECRET: 's3cret', OTHER: 'val' });
    });

    it('should throw a descriptive error when decryption fails', async () => {
      jest.spyOn(ExecUtils, 'decryptFileToString').mockReturnValue({
        success: false,
        error: 'gpg: decryption failed: Bad session key',
      });

      await expect(
        FileUtils.loadEnvSource(
          { path: '/tmp/fake.gpg', encrypted: true },
          'wrong'
        )
      ).rejects.toThrow(/Decryption failed/);
    });

    it('should throw when encrypted source is requested without a passphrase', async () => {
      await expect(
        FileUtils.loadEnvSource({ path: '/tmp/fake.gpg', encrypted: true })
      ).rejects.toThrow(/passphrase/i);
    });
  });

  describe('findProjectRoot', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-findroot-'));
      // Resolve symlinks (macOS /var → /private/var) so path assertions are
      // comparing apples to apples regardless of platform.
      tempDir = await fs.realpath(tempDir);
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('returns cwd itself when cwd contains .envrc', async () => {
      await fs.writeFile(path.join(tempDir, '.envrc'), 'export FOO=bar');
      const result = await FileUtils.findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it('returns cwd itself when cwd contains .envxrc', async () => {
      await fs.writeJson(path.join(tempDir, '.envxrc'), {});
      const result = await FileUtils.findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it('returns cwd itself when cwd contains a .git directory', async () => {
      await fs.ensureDir(path.join(tempDir, '.git'));
      const result = await FileUtils.findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it('returns cwd itself when cwd contains a .git file (submodule)', async () => {
      await fs.writeFile(
        path.join(tempDir, '.git'),
        'gitdir: ../.git/modules/sub\n'
      );
      const result = await FileUtils.findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it('returns nearest ancestor when cwd has no markers', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeFile(path.join(tempDir, '.envrc'), 'export FOO=bar');

      const result = await FileUtils.findProjectRoot(sub);
      expect(result).toBe(tempDir);
    });

    it('prefers the nearest ancestor when multiple contain markers', async () => {
      const mid = path.join(tempDir, 'repo');
      const sub = path.join(mid, 'packages', 'db');
      await fs.ensureDir(sub);
      // Outer marker: tempDir has .envrc
      await fs.writeFile(path.join(tempDir, '.envrc'), 'export OUTER=1');
      // Inner marker: mid has .git
      await fs.ensureDir(path.join(mid, '.git'));

      const result = await FileUtils.findProjectRoot(sub);
      expect(result).toBe(mid);
    });

    it('returns null when no marker exists up to the filesystem root', async () => {
      const sub = path.join(tempDir, 'deep', 'nested', 'path');
      await fs.ensureDir(sub);
      // No markers anywhere inside tempDir, and tempDir itself is in /tmp which
      // has no markers either. (This assumes /tmp is not a git repo, which is
      // standard on macOS and Linux CI.)
      const result = await FileUtils.findProjectRoot(sub);
      expect(result).toBeNull();
    });

    it('handles relative paths by resolving them first', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeFile(path.join(tempDir, '.envrc'), 'export FOO=bar');

      const originalCwd = process.cwd();
      try {
        process.chdir(sub);
        const result = await FileUtils.findProjectRoot('.');
        expect(result).toBe(tempDir);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('findEnvrcUpward', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-findenvrc-'));
      tempDir = await fs.realpath(tempDir);
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('returns directory containing .envrc when walking from a subdirectory', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeFile(path.join(tempDir, '.envrc'), 'export DEV_SECRET="s"');

      const result = await FileUtils.findEnvrcUpward(sub);
      expect(result).toBe(tempDir);
    });

    it('returns cwd when .envrc is in cwd', async () => {
      await fs.writeFile(path.join(tempDir, '.envrc'), 'export DEV_SECRET="s"');
      const result = await FileUtils.findEnvrcUpward(tempDir);
      expect(result).toBe(tempDir);
    });

    it('returns null when project root has .git but no .envrc', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.ensureDir(path.join(tempDir, '.git'));
      // No .envrc anywhere.

      const result = await FileUtils.findEnvrcUpward(sub);
      expect(result).toBeNull();
    });

    it('returns null when project root has .envxrc but no .envrc', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeJson(path.join(tempDir, '.envxrc'), {});

      const result = await FileUtils.findEnvrcUpward(sub);
      expect(result).toBeNull();
    });

    it('returns null when no project root is found', async () => {
      const sub = path.join(tempDir, 'nothing', 'here');
      await fs.ensureDir(sub);
      const result = await FileUtils.findEnvrcUpward(sub);
      expect(result).toBeNull();
    });
  });

  describe('findEnvxrcUpward', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-findenvxrc-'));
      tempDir = await fs.realpath(tempDir);
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('returns directory containing .envxrc when walking from a subdirectory', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeJson(path.join(tempDir, '.envxrc'), {
        ignore: ['demo'],
      });

      const result = await FileUtils.findEnvxrcUpward(sub);
      expect(result).toBe(tempDir);
    });

    it('returns null when project root has .envrc but no .envxrc', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeFile(path.join(tempDir, '.envrc'), 'export DEV_SECRET="s"');

      const result = await FileUtils.findEnvxrcUpward(sub);
      expect(result).toBeNull();
    });

    it('returns null when no project root is found', async () => {
      const sub = path.join(tempDir, 'nothing', 'here');
      await fs.ensureDir(sub);
      const result = await FileUtils.findEnvxrcUpward(sub);
      expect(result).toBeNull();
    });
  });

  describe('readEnvrcNearest', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-readenvrc-'));
      tempDir = await fs.realpath(tempDir);
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('returns parsed .envrc contents when found at an ancestor', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeFile(
        path.join(tempDir, '.envrc'),
        'export DEV_SECRET="my-passphrase"\nexport OTHER="value"\n'
      );

      const result = await FileUtils.readEnvrcNearest(sub);
      expect(result).toEqual({
        DEV_SECRET: 'my-passphrase',
        OTHER: 'value',
      });
    });

    it('returns parsed .envrc contents when found in cwd', async () => {
      await fs.writeFile(
        path.join(tempDir, '.envrc'),
        'export PROD_SECRET="p"\n'
      );

      const result = await FileUtils.readEnvrcNearest(tempDir);
      expect(result).toEqual({ PROD_SECRET: 'p' });
    });

    it('returns empty object when no .envrc is found anywhere', async () => {
      const sub = path.join(tempDir, 'nothing', 'here');
      await fs.ensureDir(sub);
      const result = await FileUtils.readEnvrcNearest(sub);
      expect(result).toEqual({});
    });

    it('returns empty object when the project root has .git but no .envrc', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.ensureDir(path.join(tempDir, '.git'));

      const result = await FileUtils.readEnvrcNearest(sub);
      expect(result).toEqual({});
    });
  });

  describe('getIgnorePatterns with upward discovery', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-ignoreup-'));
      tempDir = await fs.realpath(tempDir);
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('honors .envxrc.ignore from an ancestor directory', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeJson(path.join(tempDir, '.envxrc'), {
        ignore: ['staging', 'demo'],
      });

      const result = await FileUtils.getIgnorePatterns(sub);
      expect(result).toEqual(['staging', 'demo']);
    });

    it('falls back to defaults when no .envxrc is found anywhere', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);

      const result = await FileUtils.getIgnorePatterns(sub);
      expect(result).toEqual(FileUtils.DEFAULT_IGNORE_PATTERNS);
    });

    it('honors .envxrc.ignore in cwd (backward compat)', async () => {
      await fs.writeJson(path.join(tempDir, '.envxrc'), {
        ignore: ['only-local'],
      });
      const result = await FileUtils.getIgnorePatterns(tempDir);
      expect(result).toEqual(['only-local']);
    });

    it('treats explicit empty ignore array as the escape hatch', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeJson(path.join(tempDir, '.envxrc'), { ignore: [] });

      const result = await FileUtils.getIgnorePatterns(sub);
      expect(result).toEqual([]);
    });
  });

  describe('getExcludeDirs with upward discovery', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-excludeup-'));
      tempDir = await fs.realpath(tempDir);
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('honors .envxrc.excludeDirs from an ancestor directory', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeJson(path.join(tempDir, '.envxrc'), {
        excludeDirs: ['vendor', 'legacy'],
      });

      const result = await FileUtils.getExcludeDirs(sub);
      expect(result).toEqual(['vendor', 'legacy']);
    });

    it('falls back to defaults when no .envxrc is found anywhere', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);

      const result = await FileUtils.getExcludeDirs(sub);
      expect(result).toEqual(FileUtils.DEFAULT_EXCLUDE_DIRS);
    });
  });

  describe('mergeEnvxrc with upward discovery', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-mergeup-'));
      tempDir = await fs.realpath(tempDir);
    });

    afterEach(async () => {
      await fs.remove(tempDir);
    });

    it('writes to the nearest existing .envxrc when called from a subdirectory', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      await fs.writeJson(path.join(tempDir, '.envxrc'), {
        ignore: ['demo'],
      });

      const result = await FileUtils.mergeEnvxrc(sub, {
        ignore: ['demo', 'staging'],
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(path.join(tempDir, '.envxrc'));

      // The subdirectory must NOT have gained its own .envxrc.
      expect(await fs.pathExists(path.join(sub, '.envxrc'))).toBe(false);

      // The root file must contain the merged config.
      const rootConfig = await fs.readJson(path.join(tempDir, '.envxrc'));
      expect(rootConfig.ignore).toEqual(['demo', 'staging']);
    });

    it('creates .envxrc in cwd when no ancestor has one', async () => {
      const sub = path.join(tempDir, 'packages', 'db');
      await fs.ensureDir(sub);
      // No .envxrc anywhere up the tree.

      const result = await FileUtils.mergeEnvxrc(sub, {
        ignore: ['demo'],
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(path.join(sub, '.envxrc'));
      expect(await fs.pathExists(path.join(sub, '.envxrc'))).toBe(true);
    });
  });
});

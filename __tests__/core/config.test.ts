import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { FileUtils } from '../../src/utils/file';

describe('Config Command Operations', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-config-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('config show', () => {
    it('should return empty config when no .envxrc exists', async () => {
      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config).toEqual({});
    });

    it('should return full config from .envxrc', async () => {
      const configData = {
        ignore: ['example', 'sample'],
        environments: ['production', 'staging'],
      };
      await FileUtils.writeEnvxrc(tempDir, configData);

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config).toEqual(configData);
    });
  });

  describe('config ignore add', () => {
    it('should add pattern to new config', async () => {
      const currentIgnore = await FileUtils.getIgnorePatterns(tempDir);
      const newIgnore = [...currentIgnore, 'test'];
      await FileUtils.mergeEnvxrc(tempDir, { ignore: newIgnore });

      const patterns = await FileUtils.getIgnorePatterns(tempDir);
      expect(patterns).toContain('test');
      expect(patterns).toContain('example');
    });

    it('should add pattern to existing config', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['custom'],
      });

      const currentIgnore = await FileUtils.getIgnorePatterns(tempDir);
      const newIgnore = [...currentIgnore, 'another'];
      await FileUtils.mergeEnvxrc(tempDir, { ignore: newIgnore });

      const patterns = await FileUtils.getIgnorePatterns(tempDir);
      expect(patterns).toEqual(['custom', 'another']);
    });

    it('should not duplicate existing pattern', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['example'],
      });

      const currentIgnore = await FileUtils.getIgnorePatterns(tempDir);
      const alreadyExists = currentIgnore.some(
        p => p.toLowerCase() === 'example'
      );
      expect(alreadyExists).toBe(true);
    });
  });

  describe('config ignore remove', () => {
    it('should remove pattern from ignore list', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['example', 'sample', 'template'],
      });

      const current = await FileUtils.getIgnorePatterns(tempDir);
      const index = current.findIndex(p => p.toLowerCase() === 'sample');
      const newIgnore = [...current];
      newIgnore.splice(index, 1);
      await FileUtils.mergeEnvxrc(tempDir, { ignore: newIgnore });

      const patterns = await FileUtils.getIgnorePatterns(tempDir);
      expect(patterns).toEqual(['example', 'template']);
      expect(patterns).not.toContain('sample');
    });
  });

  describe('config exclude list', () => {
    it('should return default exclude dirs when no config', async () => {
      const dirs = await FileUtils.getExcludeDirs(tempDir);
      expect(dirs).toEqual(FileUtils.DEFAULT_EXCLUDE_DIRS);
    });

    it('should return custom exclude dirs from config', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        excludeDirs: ['node_modules', '.vercel'],
      });

      const dirs = await FileUtils.getExcludeDirs(tempDir);
      expect(dirs).toEqual(['node_modules', '.vercel']);
    });
  });

  describe('config exclude add', () => {
    it('should add directory to new config', async () => {
      const currentDirs = await FileUtils.getExcludeDirs(tempDir);
      const newDirs = [...currentDirs, '.vercel'];
      await FileUtils.mergeEnvxrc(tempDir, { excludeDirs: newDirs });

      const dirs = await FileUtils.getExcludeDirs(tempDir);
      expect(dirs).toContain('.vercel');
      expect(dirs).toContain('node_modules');
    });

    it('should add directory to existing config', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        excludeDirs: ['node_modules'],
      });

      const currentDirs = await FileUtils.getExcludeDirs(tempDir);
      const newDirs = [...currentDirs, '.vercel'];
      await FileUtils.mergeEnvxrc(tempDir, { excludeDirs: newDirs });

      const dirs = await FileUtils.getExcludeDirs(tempDir);
      expect(dirs).toEqual(['node_modules', '.vercel']);
    });
  });

  describe('config exclude remove', () => {
    it('should remove directory from exclusion list', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        excludeDirs: ['node_modules', 'dist', '.next'],
      });

      const current = await FileUtils.getExcludeDirs(tempDir);
      const index = current.findIndex(d => d === 'dist');
      const newDirs = [...current];
      newDirs.splice(index, 1);
      await FileUtils.mergeEnvxrc(tempDir, { excludeDirs: newDirs });

      const dirs = await FileUtils.getExcludeDirs(tempDir);
      expect(dirs).toEqual(['node_modules', '.next']);
      expect(dirs).not.toContain('dist');
    });
  });

  describe('config reset', () => {
    it('should reset to default ignore patterns and exclude dirs', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['custom', 'patterns'],
        environments: ['production'],
        excludeDirs: ['custom_dir'],
      });

      await FileUtils.writeEnvxrc(tempDir, {
        ignore: [...FileUtils.DEFAULT_IGNORE_PATTERNS],
        excludeDirs: [...FileUtils.DEFAULT_EXCLUDE_DIRS],
      });

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config.ignore).toEqual(FileUtils.DEFAULT_IGNORE_PATTERNS);
      expect(config.excludeDirs).toEqual(FileUtils.DEFAULT_EXCLUDE_DIRS);
      // Reset clears other fields
      expect(config.environments).toBeUndefined();
    });
  });
});

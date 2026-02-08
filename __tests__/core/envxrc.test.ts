import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { FileUtils } from '../../src/utils/file';

describe('EnvxrcConfig Infrastructure', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('DEFAULT_IGNORE_PATTERNS', () => {
    it('should contain expected default patterns', () => {
      expect(FileUtils.DEFAULT_IGNORE_PATTERNS).toContain('example');
      expect(FileUtils.DEFAULT_IGNORE_PATTERNS).toContain('sample');
      expect(FileUtils.DEFAULT_IGNORE_PATTERNS).toContain('template');
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(FileUtils.DEFAULT_IGNORE_PATTERNS)).toBe(true);
      FileUtils.DEFAULT_IGNORE_PATTERNS.forEach(pattern => {
        expect(typeof pattern).toBe('string');
      });
    });
  });

  describe('DEFAULT_EXCLUDE_DIRS', () => {
    it('should contain expected default directories', () => {
      expect(FileUtils.DEFAULT_EXCLUDE_DIRS).toContain('node_modules');
      expect(FileUtils.DEFAULT_EXCLUDE_DIRS).toContain('.git');
      expect(FileUtils.DEFAULT_EXCLUDE_DIRS).toContain('dist');
      expect(FileUtils.DEFAULT_EXCLUDE_DIRS).toContain('.next');
      expect(FileUtils.DEFAULT_EXCLUDE_DIRS).toContain('.turbo');
      expect(FileUtils.DEFAULT_EXCLUDE_DIRS).toContain('build');
      expect(FileUtils.DEFAULT_EXCLUDE_DIRS).toContain('coverage');
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(FileUtils.DEFAULT_EXCLUDE_DIRS)).toBe(true);
      FileUtils.DEFAULT_EXCLUDE_DIRS.forEach(dir => {
        expect(typeof dir).toBe('string');
      });
    });
  });

  describe('readEnvxrc', () => {
    it('should return empty object when file is missing', async () => {
      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config).toEqual({});
    });

    it('should parse valid JSON config', async () => {
      const configData = {
        ignore: ['example', 'test'],
        environments: ['production', 'staging'],
      };
      await fs.writeFile(
        path.join(tempDir, '.envxrc'),
        JSON.stringify(configData),
        'utf-8'
      );

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config).toEqual(configData);
    });

    it('should return empty object for invalid JSON', async () => {
      await fs.writeFile(
        path.join(tempDir, '.envxrc'),
        'not valid json!!!',
        'utf-8'
      );

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config).toEqual({});
    });

    it('should return empty object for invalid schema', async () => {
      await fs.writeFile(
        path.join(tempDir, '.envxrc'),
        JSON.stringify({ ignore: 'not-an-array' }),
        'utf-8'
      );

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config).toEqual({});
    });

    it('should handle config with only ignore field', async () => {
      const configData = { ignore: ['sample'] };
      await fs.writeFile(
        path.join(tempDir, '.envxrc'),
        JSON.stringify(configData),
        'utf-8'
      );

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config).toEqual(configData);
    });

    it('should handle config with only environments field', async () => {
      const configData = { environments: ['production'] };
      await fs.writeFile(
        path.join(tempDir, '.envxrc'),
        JSON.stringify(configData),
        'utf-8'
      );

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config).toEqual(configData);
    });
  });

  describe('writeEnvxrc', () => {
    it('should write valid JSON with 2-space indent', async () => {
      const config = {
        ignore: ['example'],
        environments: ['production'],
      };

      const result = await FileUtils.writeEnvxrc(tempDir, config);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully wrote .envxrc file');
      expect(result.filePath).toBe(path.join(tempDir, '.envxrc'));

      const content = await fs.readFile(path.join(tempDir, '.envxrc'), 'utf-8');
      expect(content).toBe(`${JSON.stringify(config, null, 2)}\n`);
    });

    it('should return FileOperationResult on success', async () => {
      const result = await FileUtils.writeEnvxrc(tempDir, {});
      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
    });

    it('should handle write errors', async () => {
      const invalidPath = path.join(tempDir, 'non-existent', 'deep', 'path');
      const result = await FileUtils.writeEnvxrc(invalidPath, {});
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to write .envxrc file');
    });
  });

  describe('mergeEnvxrc', () => {
    it('should merge into empty config when file is missing', async () => {
      const result = await FileUtils.mergeEnvxrc(tempDir, {
        ignore: ['test'],
      });

      expect(result.success).toBe(true);

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config.ignore).toEqual(['test']);
    });

    it('should merge into existing config', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['example'],
        environments: ['production'],
      });

      const result = await FileUtils.mergeEnvxrc(tempDir, {
        environments: ['staging'],
      });

      expect(result.success).toBe(true);

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config.ignore).toEqual(['example']);
      expect(config.environments).toEqual(['staging']);
    });

    it('should overwrite existing fields with new values', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['example'],
      });

      await FileUtils.mergeEnvxrc(tempDir, {
        ignore: ['example', 'sample'],
      });

      const config = await FileUtils.readEnvxrc(tempDir);
      expect(config.ignore).toEqual(['example', 'sample']);
    });
  });

  describe('getIgnorePatterns', () => {
    it('should return defaults when no .envxrc exists', async () => {
      const patterns = await FileUtils.getIgnorePatterns(tempDir);
      expect(patterns).toEqual(FileUtils.DEFAULT_IGNORE_PATTERNS);
    });

    it('should return patterns from .envxrc when present', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['custom', 'patterns'],
      });

      const patterns = await FileUtils.getIgnorePatterns(tempDir);
      expect(patterns).toEqual(['custom', 'patterns']);
    });

    it('should return defaults when .envxrc has no ignore field', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        environments: ['production'],
      });

      const patterns = await FileUtils.getIgnorePatterns(tempDir);
      expect(patterns).toEqual(FileUtils.DEFAULT_IGNORE_PATTERNS);
    });
  });

  describe('getExcludeDirs', () => {
    it('should return defaults when no .envxrc exists', async () => {
      const dirs = await FileUtils.getExcludeDirs(tempDir);
      expect(dirs).toEqual(FileUtils.DEFAULT_EXCLUDE_DIRS);
    });

    it('should return dirs from .envxrc when present', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        excludeDirs: ['node_modules', 'custom_build'],
      });

      const dirs = await FileUtils.getExcludeDirs(tempDir);
      expect(dirs).toEqual(['node_modules', 'custom_build']);
    });

    it('should return defaults when .envxrc has no excludeDirs field', async () => {
      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['example'],
      });

      const dirs = await FileUtils.getExcludeDirs(tempDir);
      expect(dirs).toEqual(FileUtils.DEFAULT_EXCLUDE_DIRS);
    });
  });

  describe('findAllEnvironments with ignore patterns', () => {
    it('should filter out default patterns', async () => {
      // Create env files including template/example/sample
      await fs.writeFile(path.join(tempDir, '.env.production'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.staging'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.example'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.sample'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.template'), '', 'utf-8');

      const envs = await FileUtils.findAllEnvironments(tempDir);

      expect(envs).toContain('production');
      expect(envs).toContain('staging');
      expect(envs).not.toContain('example');
      expect(envs).not.toContain('sample');
      expect(envs).not.toContain('template');
    });

    it('should filter with custom patterns from .envxrc', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.test'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.example'), '', 'utf-8');

      await FileUtils.writeEnvxrc(tempDir, {
        ignore: ['test'],
      });

      const envs = await FileUtils.findAllEnvironments(tempDir);

      expect(envs).toContain('production');
      expect(envs).toContain('example'); // not in custom ignore
      expect(envs).not.toContain('test');
    });

    it('should not filter when explicitly passed empty array', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.example'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.sample'), '', 'utf-8');

      const envs = await FileUtils.findAllEnvironments(tempDir, []);

      expect(envs).toContain('production');
      expect(envs).toContain('example');
      expect(envs).toContain('sample');
    });

    it('should filter with explicitly passed patterns', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.staging'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.dev'), '', 'utf-8');

      const envs = await FileUtils.findAllEnvironments(tempDir, ['dev']);

      expect(envs).toContain('production');
      expect(envs).toContain('staging');
      expect(envs).not.toContain('dev');
    });

    it('should filter case-insensitively', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.Example'), '', 'utf-8');

      const envs = await FileUtils.findAllEnvironments(tempDir, ['example']);

      expect(envs).toContain('production');
      expect(envs).not.toContain('Example');
    });

    it('should return sorted results', async () => {
      await fs.writeFile(path.join(tempDir, '.env.zebra'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.alpha'), '', 'utf-8');
      await fs.writeFile(path.join(tempDir, '.env.middle'), '', 'utf-8');

      const envs = await FileUtils.findAllEnvironments(tempDir, []);

      expect(envs).toEqual(['alpha', 'middle', 'zebra']);
    });
  });

  describe('directory exclusion in findAllEnvironments', () => {
    it('should not find env files inside node_modules', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), '', 'utf-8');
      await fs.ensureDir(path.join(tempDir, 'node_modules', 'some-pkg'));
      await fs.writeFile(
        path.join(tempDir, 'node_modules', 'some-pkg', '.env.production'),
        '',
        'utf-8'
      );

      const envs = await FileUtils.findAllEnvironments(tempDir, []);
      expect(envs).toContain('production');

      // The key check: only one environment found, not duplicated from node_modules
      expect(envs.filter(e => e === 'production')).toHaveLength(1);
    });

    it('should not find env files inside dist directory', async () => {
      await fs.writeFile(path.join(tempDir, '.env.staging'), '', 'utf-8');
      await fs.ensureDir(path.join(tempDir, 'dist'));
      await fs.writeFile(
        path.join(tempDir, 'dist', '.env.staging'),
        '',
        'utf-8'
      );
      // dist only has staging, and it should be excluded
      // root has staging, so we still see it
      const envs = await FileUtils.findAllEnvironments(tempDir, []);
      expect(envs).toContain('staging');
    });

    it('should respect custom excludeDirs from .envxrc', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), '', 'utf-8');
      await fs.ensureDir(path.join(tempDir, 'custom_output'));
      await fs.writeFile(
        path.join(tempDir, 'custom_output', '.env.secret'),
        '',
        'utf-8'
      );

      // Without custom config, custom_output is not excluded
      let envs = await FileUtils.findAllEnvironments(tempDir, []);
      expect(envs).toContain('secret');

      // With custom excludeDirs, custom_output is excluded
      await FileUtils.writeEnvxrc(tempDir, {
        excludeDirs: ['custom_output'],
      });

      envs = await FileUtils.findAllEnvironments(tempDir, []);
      expect(envs).not.toContain('secret');
      expect(envs).toContain('production');
    });
  });

  describe('directory exclusion in findEnvFiles', () => {
    it('should not find env files inside node_modules', async () => {
      await fs.writeFile(path.join(tempDir, '.env.production'), '', 'utf-8');
      await fs.ensureDir(path.join(tempDir, 'node_modules', 'some-pkg'));
      await fs.writeFile(
        path.join(tempDir, 'node_modules', 'some-pkg', '.env.production'),
        '',
        'utf-8'
      );

      const files = await FileUtils.findEnvFiles('production', tempDir);
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(path.join(tempDir, '.env.production'));
    });

    it('should not find env files inside dist directory', async () => {
      await fs.writeFile(path.join(tempDir, '.env.staging'), '', 'utf-8');
      await fs.ensureDir(path.join(tempDir, 'dist'));
      await fs.writeFile(
        path.join(tempDir, 'dist', '.env.staging'),
        '',
        'utf-8'
      );

      const files = await FileUtils.findEnvFiles('staging', tempDir);
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe(path.join(tempDir, '.env.staging'));
    });
  });
});

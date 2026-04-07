import crypto from 'crypto';
import * as dotenv from 'dotenv';
import { expand } from 'dotenv-expand';
import fastGlob from 'fast-glob';
import fs from 'fs-extra';
import { replace } from 'lodash';
import path from 'path';
import { envxrcFileConfigSchema } from '../schemas';
import {
  EnvFile,
  EnvrcConfig,
  EnvxrcConfig,
  FileOperationResult,
} from '../types';
import { ExecUtils } from './exec';

export class FileUtils {
  static readonly DEFAULT_IGNORE_PATTERNS = ['example', 'sample', 'template'];
  static readonly DEFAULT_EXCLUDE_DIRS = [
    'node_modules',
    '.git',
    'dist',
    '.next',
    '.turbo',
    '.output',
    '.nuxt',
    '.cache',
    'build',
    'coverage',
    '.svelte-kit',
  ];

  /**
   * Read .envxrc config file
   */
  static async readEnvxrc(cwd: string): Promise<EnvxrcConfig> {
    const envxrcPath = path.join(cwd, '.envxrc');

    if (!(await this.fileExists(envxrcPath))) {
      return {};
    }

    try {
      const content = await fs.readFile(envxrcPath, 'utf-8');
      const parsed = JSON.parse(content);
      return envxrcFileConfigSchema.parse(parsed);
    } catch {
      return {};
    }
  }

  /**
   * Write .envxrc config file
   */
  static async writeEnvxrc(
    cwd: string,
    config: EnvxrcConfig
  ): Promise<FileOperationResult> {
    const envxrcPath = path.join(cwd, '.envxrc');

    try {
      await fs.writeFile(
        envxrcPath,
        `${JSON.stringify(config, null, 2)}\n`,
        'utf-8'
      );

      return {
        success: true,
        message: 'Successfully wrote .envxrc file',
        filePath: envxrcPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to write .envxrc file: ${error}`,
        filePath: envxrcPath,
        error: error as Error,
      };
    }
  }

  /**
   * Merge partial config into existing .envxrc
   */
  static async mergeEnvxrc(
    cwd: string,
    partial: Partial<EnvxrcConfig>
  ): Promise<FileOperationResult> {
    const existing = await this.readEnvxrc(cwd);
    const merged: EnvxrcConfig = { ...existing, ...partial };
    return this.writeEnvxrc(cwd, merged);
  }

  /**
   * Get ignore patterns from .envxrc or defaults
   */
  static async getIgnorePatterns(cwd: string): Promise<string[]> {
    const config = await this.readEnvxrc(cwd);
    return config.ignore ?? this.DEFAULT_IGNORE_PATTERNS;
  }

  /**
   * Get excluded directories from .envxrc or defaults
   */
  static async getExcludeDirs(cwd: string): Promise<string[]> {
    const config = await this.readEnvxrc(cwd);
    return config.excludeDirs ?? this.DEFAULT_EXCLUDE_DIRS;
  }

  /**
   * Find all .env files for a specific environment
   */
  static async findEnvFiles(
    environment: string,
    cwd: string
  ): Promise<EnvFile[]> {
    const pattern = `**/.env.${environment}`;
    const encryptedPattern = `**/.env.${environment}.gpg`;
    const excludeDirs = await this.getExcludeDirs(cwd);
    const ignore = excludeDirs.map(dir => `**/${dir}/**`);

    const [envFiles, encryptedFiles] = await Promise.all([
      fastGlob(pattern, { cwd, dot: true, ignore }),
      fastGlob(encryptedPattern, { cwd, dot: true, ignore }),
    ]);

    const results: EnvFile[] = [];

    // Add regular env files
    for (const filePath of envFiles) {
      results.push({
        path: path.join(cwd, filePath),
        stage: environment,
        encrypted: false,
        exists: true,
      });
    }

    // Add encrypted env files
    for (const filePath of encryptedFiles) {
      const decryptedPath = replace(filePath, '.gpg', '');
      results.push({
        path: path.join(cwd, decryptedPath),
        stage: environment,
        encrypted: true,
        exists: true,
      });
    }

    return results;
  }

  /**
   * Find all environments in the project
   * @param ignorePatterns - patterns to filter out (case-insensitive exact match).
   *   undefined = load from .envxrc or use defaults.
   *   [] = no filtering (escape hatch).
   */
  static async findAllEnvironments(
    cwd: string,
    ignorePatterns?: string[]
  ): Promise<string[]> {
    const pattern = '**/.env.*';
    const excludeDirs = await this.getExcludeDirs(cwd);
    const ignore = excludeDirs.map(dir => `**/${dir}/**`);
    const files = await fastGlob(pattern, { cwd, dot: true, ignore });

    const environments = new Set<string>();

    for (const file of files) {
      const basename = path.basename(file);
      const match = basename.match(/^\.env\.([^.]+)(\.gpg)?$/);
      if (match && match[1]) {
        environments.add(match[1]);
      }
    }

    // Resolve ignore patterns
    const patterns =
      ignorePatterns !== undefined
        ? ignorePatterns
        : await this.getIgnorePatterns(cwd);

    // Filter out ignored environments
    const filtered = Array.from(environments).filter(
      env => !patterns.some(p => p.toLowerCase() === env.toLowerCase())
    );

    return filtered.sort();
  }

  /**
   * Resolve the env file for a stage, looking ONLY in cwd (no recursion).
   *
   * Returns the encrypted variant if both plain and encrypted exist.
   * Returns null if neither exists.
   */
  static async resolveStageFile(
    stage: string,
    cwd: string
  ): Promise<{ path: string; encrypted: boolean } | null> {
    const encryptedPath = path.join(cwd, `.env.${stage}.gpg`);
    const plainPath = path.join(cwd, `.env.${stage}`);

    if (await this.fileExists(encryptedPath)) {
      return { path: encryptedPath, encrypted: true };
    }
    if (await this.fileExists(plainPath)) {
      return { path: plainPath, encrypted: false };
    }
    return null;
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Create backup of a file
   */
  static async createBackup(filePath: string): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const backupPath = `${filePath}.backup.${timestamp}.${random}`;
    await fs.copy(filePath, backupPath);
    return backupPath;
  }

  /**
   * Remove backup file
   */
  static async removeBackup(backupPath: string): Promise<void> {
    if (await this.fileExists(backupPath)) {
      await fs.remove(backupPath);
    }
  }

  /**
   * Get file hash for comparison
   */
  static async getFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  /**
   * Compare two files by hash
   */
  static async filesAreIdentical(
    file1: string,
    file2: string
  ): Promise<boolean> {
    if (!(await this.fileExists(file1)) || !(await this.fileExists(file2))) {
      return false;
    }

    const [hash1, hash2] = await Promise.all([
      this.getFileHash(file1),
      this.getFileHash(file2),
    ]);

    return hash1 === hash2;
  }

  /**
   * Load an env source (plain or encrypted) into a parsed key/value map.
   *
   * For encrypted sources, a passphrase must be supplied. Decryption
   * happens in-memory via ExecUtils.decryptFileToString — nothing is
   * ever written to disk.
   */
  static async loadEnvSource(
    source: { path: string; encrypted: boolean },
    passphrase?: string
  ): Promise<Record<string, string>> {
    let content: string;

    if (source.encrypted) {
      if (!passphrase) {
        throw new Error(
          `Cannot load encrypted source ${source.path}: passphrase is required`
        );
      }
      const result = ExecUtils.decryptFileToString(source.path, passphrase);
      if (!result.success) {
        throw new Error(
          `Decryption failed for ${source.path}: ${result.error ?? 'unknown error'}`
        );
      }
      content = result.content ?? '';
    } else {
      content = await fs.readFile(source.path, 'utf-8');
    }

    return this.parseEnvContent(content);
  }

  /**
   * Read .envrc file and parse it
   */
  static async readEnvrc(cwd: string): Promise<EnvrcConfig> {
    const envrcPath = path.join(cwd, '.envrc');

    if (!(await this.fileExists(envrcPath))) {
      return {};
    }

    try {
      const content = await fs.readFile(envrcPath, 'utf-8');
      const config: EnvrcConfig = {};

      // Parse simple export statements
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('export ')) {
          const exportStatement = trimmed.substring(7);
          const [key, ...valueParts] = exportStatement.split('=');
          if (key && valueParts.length > 0) {
            let value = valueParts.join('=');
            // Remove quotes if present
            value = value.replace(/^["']|["']$/g, '');
            config[key.trim()] = value;
          }
        }
      }

      return config;
    } catch (error) {
      console.warn(`Warning: Could not read .envrc file: ${error}`);
      return {};
    }
  }

  /**
   * Parse .env-style content into a key/value map.
   *
   * Runs dotenv.parse for tokenisation, then dotenv-expand for ${VAR} /
   * ${VAR:-default} expansion. Expansion reads from process.env but is
   * given a COPY so real process.env is never mutated.
   *
   * Does not support command substitution ($(...)) — intentionally.
   */
  static parseEnvContent(content: string): Record<string, string> {
    const parsed = dotenv.parse(content);
    // Pass a throwaway copy so dotenv-expand's in-place writes to processEnv
    // don't leak into the real environment. Reading still sees current vars.
    const processEnvCopy: Record<string, string> = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    );
    expand({ parsed, processEnv: processEnvCopy });
    return parsed;
  }

  /**
   * Write .envrc file
   */
  static async writeEnvrc(
    cwd: string,
    config: EnvrcConfig
  ): Promise<FileOperationResult> {
    const envrcPath = path.join(cwd, '.envrc');

    try {
      const lines = ['# Environment secrets generated by envx', ''];

      for (const [key, value] of Object.entries(config)) {
        lines.push(`export ${key}="${value}"`);
      }

      lines.push(''); // End with newline

      await fs.writeFile(envrcPath, lines.join('\n'), 'utf-8');

      return {
        success: true,
        message: 'Successfully wrote .envrc file',
        filePath: envrcPath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to write .envrc file: ${error}`,
        filePath: envrcPath,
        error: error as Error,
      };
    }
  }

  /**
   * Create a template .env file
   */
  static async createEnvTemplate(
    filePath: string,
    template?: string
  ): Promise<FileOperationResult> {
    try {
      let content = '';

      if (template && (await this.fileExists(template))) {
        // Use provided template file
        content = await fs.readFile(template, 'utf-8');
      } else {
        // Create basic template
        content = [
          '# Environment variables',
          '# Add your environment-specific variables here',
          '',
          '# Example:',
          '# DATABASE_URL=',
          '# API_KEY=',
          '# DEBUG=false',
          '',
        ].join('\n');
      }

      await fs.writeFile(filePath, content, 'utf-8');

      return {
        success: true,
        message: `Successfully created .env file`,
        filePath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create .env file: ${error}`,
        filePath,
        error: error as Error,
      };
    }
  }

  /**
   * Generate a random secret
   */
  static generateRandomSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate stage secret variable name
   */
  static generateSecretVariableName(stage: string): string {
    return `${stage.toUpperCase()}_SECRET`;
  }

  /**
   * Ensure directory exists
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * Get relative path from cwd
   */
  static getRelativePath(absolutePath: string, cwd: string): string {
    return path.relative(cwd, absolutePath);
  }

  /**
   * Validate environment name
   */
  static isValidEnvironmentName(name: string): boolean {
    // Allow alphanumeric, hyphens, underscores
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * Get encrypted file path
   */
  static getEncryptedPath(filePath: string): string {
    return `${filePath}.gpg`;
  }

  /**
   * Get decrypted file path
   */
  static getDecryptedPath(encryptedPath: string): string {
    return replace(encryptedPath, '.gpg', '');
  }

  /**
   * Check if path is encrypted file
   */
  static isEncryptedFile(filePath: string): boolean {
    return filePath.endsWith('.gpg');
  }

  /**
   * Get file stats
   */
  static async getFileStats(
    filePath: string
  ): Promise<{ size: number; mtime: Date }> {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      mtime: stats.mtime,
    };
  }

  /**
   * Update .gitignore with smart EnvX patterns
   */
  static async updateGitignore(cwd: string): Promise<FileOperationResult> {
    const gitignorePath = path.join(cwd, '.gitignore');

    const envPatterns = ['.env.*', '!.env.example', '!.env.*.gpg'];
    const secretPatterns = ['.envrc', '.envxrc'];

    try {
      let existingContent = '';
      if (await this.fileExists(gitignorePath)) {
        existingContent = await fs.readFile(gitignorePath, 'utf-8');
      }

      // Check which patterns are missing
      const missingEnvPatterns = envPatterns.filter(
        pattern => !existingContent.includes(pattern)
      );
      const missingSecretPatterns = secretPatterns.filter(
        pattern => !existingContent.includes(pattern)
      );

      // If all patterns exist, no need to update
      if (
        missingEnvPatterns.length === 0 &&
        missingSecretPatterns.length === 0
      ) {
        return {
          success: true,
          message: '.gitignore already contains all EnvX patterns',
          filePath: gitignorePath,
        };
      }

      let newContent = existingContent.trim();
      const addedSections = [];

      // Add Environment files section if needed
      if (missingEnvPatterns.length > 0) {
        const envSection = [
          '',
          '# Environment files',
          ...missingEnvPatterns.map(pattern =>
            pattern === '!.env.*.gpg' ? `${pattern}` : pattern
          ),
        ];
        newContent += (newContent ? '\n' : '') + envSection.join('\n');
        addedSections.push('Environment files');
      }

      // Add EnvX secrets section if needed
      if (missingSecretPatterns.length > 0) {
        const secretSection = [
          '',
          '# EnvX secrets',
          ...missingSecretPatterns.map(pattern =>
            pattern === '.envrc' ? `${pattern}` : pattern
          ),
        ];
        newContent += (newContent ? '\n' : '') + secretSection.join('\n');
        addedSections.push('EnvX secrets');
      }

      newContent += '\n';

      await fs.writeFile(gitignorePath, newContent, 'utf-8');

      const message =
        addedSections.length > 0
          ? `Successfully updated .gitignore with ${addedSections.join(' and ')} patterns`
          : 'Successfully updated .gitignore with EnvX patterns';

      return {
        success: true,
        message,
        filePath: gitignorePath,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update .gitignore: ${error}`,
        filePath: gitignorePath,
        error: error as Error,
      };
    }
  }
}

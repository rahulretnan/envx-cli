import chalk from 'chalk';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import shell from 'shelljs';
import { CommandResult } from '../types';

export class ExecUtils {
  /**
   * Execute a shell command with proper error handling
   */
  static exec(
    command: string,
    options: { silent?: boolean; cwd?: string } = {}
  ): CommandResult {
    try {
      const { silent = false, cwd } = options;

      if (!silent) {
        console.log(chalk.blue(`Executing: ${command}`));
      }

      const result = execSync(command, {
        cwd: cwd || process.cwd(),
        encoding: 'utf-8',
        stdio: silent ? 'pipe' : 'inherit',
      });

      return {
        success: true,
        message: 'Command executed successfully',
        data: result,
      };
    } catch (error) {
      const err = error as Error & { status?: number; stderr?: string };

      return {
        success: false,
        message: `Command failed: ${err.message}`,
        errors: [err.stderr || err.message],
      };
    }
  }

  /**
   * Execute GPG encrypt command
   */
  static encryptFile(filePath: string, passphrase: string): CommandResult {
    const command = `gpg --passphrase "${passphrase}" --quiet --yes --batch -c "${filePath}"`;
    return this.exec(command, { silent: true });
  }

  /**
   * Execute GPG decrypt command
   */
  static decryptFile(
    encryptedPath: string,
    outputPath: string,
    passphrase: string
  ): CommandResult {
    const command = `gpg --passphrase "${passphrase}" --quiet --yes --batch -o "${outputPath}" -d "${encryptedPath}"`;
    return this.exec(command, { silent: true });
  }

  /**
   * Check if GPG is available
   */
  static isGpgAvailable(): boolean {
    try {
      execSync('gpg --version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current working directory
   */
  static getCurrentDir(): string {
    return shell.pwd().toString();
  }

  /**
   * Check if directory exists
   */
  static dirExists(path: string): boolean {
    return shell.test('-d', path);
  }

  /**
   * Check if file exists
   */
  static fileExists(path: string): boolean {
    return shell.test('-f', path);
  }

  /**
   * Create directory if it doesn't exist
   */
  static ensureDir(path: string): void {
    shell.mkdir('-p', path);
  }

  /**
   * Copy file
   */
  static copyFile(source: string, destination: string): CommandResult {
    try {
      shell.cp(source, destination);
      return {
        success: true,
        message: `File copied from ${source} to ${destination}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to copy file: ${error}`,
        errors: [String(error)],
      };
    }
  }

  /**
   * Move file
   */
  static moveFile(source: string, destination: string): CommandResult {
    try {
      shell.mv(source, destination);
      return {
        success: true,
        message: `File moved from ${source} to ${destination}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to move file: ${error}`,
        errors: [String(error)],
      };
    }
  }

  /**
   * Remove file
   */
  static removeFile(path: string): CommandResult {
    try {
      shell.rm(path);
      return {
        success: true,
        message: `File removed: ${path}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to remove file: ${error}`,
        errors: [String(error)],
      };
    }
  }

  /**
   * Test GPG encryption/decryption with a test file
   */
  static testGpgOperation(passphrase: string): CommandResult {
    const testContent = 'test-content-for-gpg';
    const testFile = `/tmp/envx-test-${Date.now()}.txt`;
    const encryptedFile = `${testFile}.gpg`;

    try {
      // Create test file
      writeFileSync(testFile, testContent);

      // Test encryption
      const encryptResult = this.encryptFile(testFile, passphrase);
      if (!encryptResult.success) {
        shell.rm('-f', testFile);
        return encryptResult;
      }

      // Test decryption
      const decryptedFile = `/tmp/envx-test-decrypted-${Date.now()}.txt`;
      const decryptResult = this.decryptFile(
        encryptedFile,
        decryptedFile,
        passphrase
      );

      // Cleanup
      shell.rm('-f', testFile, encryptedFile, decryptedFile);

      if (!decryptResult.success) {
        return decryptResult;
      }

      return {
        success: true,
        message: 'GPG operations test passed',
      };
    } catch (error) {
      // Cleanup on error
      shell.rm('-f', testFile, encryptedFile);

      return {
        success: false,
        message: `GPG test failed: ${error}`,
        errors: [String(error)],
      };
    }
  }
}

export class CliUtils {
  /**
   * Print success message
   */
  static success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  /**
   * Print error message
   */
  static error(message: string): void {
    console.log(chalk.red('✗'), message);
  }

  /**
   * Print warning message
   */
  static warning(message: string): void {
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Print info message
   */
  static info(message: string): void {
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Print header
   */
  static header(message: string): void {
    console.log();
    console.log(chalk.bold.cyan(message));
    console.log(chalk.cyan('='.repeat(message.length)));
  }

  /**
   * Print subheader
   */
  static subheader(message: string): void {
    console.log();
    console.log(chalk.bold(message));
    console.log('-'.repeat(message.length));
  }

  /**
   * Print file operation result
   */
  static printFileOperation(result: CommandResult, operation: string): void {
    if (result.success) {
      this.success(`${operation}: ${result.message}`);
    } else {
      this.error(`${operation}: ${result.message}`);
      if (result.errors) {
        result.errors.forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
      }
    }
  }

  /**
   * Print table of files
   */
  static printTable(headers: string[], rows: string[][]): void {
    const columnWidths = headers.map((header, index) => {
      const columnValues = [header, ...rows.map(row => row[index] || '')];
      return Math.max(...columnValues.map(val => val.length));
    });

    // Print header
    const headerRow = headers
      .map((header, index) => header.padEnd(columnWidths[index]))
      .join(' | ');

    console.log(chalk.bold(headerRow));
    console.log(columnWidths.map(width => '-'.repeat(width)).join('-|-'));

    // Print rows
    rows.forEach(row => {
      const formattedRow = row
        .map((cell, index) => (cell || '').padEnd(columnWidths[index]))
        .join(' | ');
      console.log(formattedRow);
    });
  }

  /**
   * Format file path for display
   */
  static formatPath(path: string, cwd: string): string {
    const relativePath = path.replace(cwd, '.');
    return chalk.cyan(relativePath);
  }

  /**
   * Format environment name for display
   */
  static formatEnvironment(env: string): string {
    return chalk.magenta(env);
  }

  /**
   * Format status for display
   */
  static formatStatus(status: string, success: boolean = true): string {
    return success ? chalk.green(status) : chalk.red(status);
  }
}

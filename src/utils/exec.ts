import chalk from 'chalk';
import { execSync, spawn, spawnSync, ChildProcess } from 'child_process';
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
   * Build the common arg array for `gpg` invocations that accept a
   * passphrase via stdin. The passphrase is NEVER placed in argv:
   *
   *   --passphrase-fd 0      Read the passphrase from stdin (fd 0).
   *   --pinentry-mode loopback
   *                          Bypass gpg-agent's pinentry — trust the
   *                          passphrase we're piping on stdin.
   *   --quiet --yes --batch  Non-interactive mode, no prompts.
   *
   * Callers pass the passphrase via spawnSync's `input` option.
   */
  private static gpgBaseArgs(): string[] {
    return [
      '--passphrase-fd',
      '0',
      '--pinentry-mode',
      'loopback',
      '--quiet',
      '--yes',
      '--batch',
    ];
  }

  /**
   * Run gpg with an argv list and feed the passphrase via stdin.
   * Returns a uniform result shape so the three GPG wrappers
   * (encryptFile, decryptFile, decryptFileToString) can share it.
   */
  private static runGpg(
    args: string[],
    passphrase: string
  ): { status: number; stdout: string; stderr: string; spawnError?: Error } {
    const result = spawnSync('gpg', args, {
      input: passphrase,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.error) {
      return {
        status: -1,
        stdout: '',
        stderr: result.error.message,
        spawnError: result.error,
      };
    }
    return {
      status: result.status ?? -1,
      stdout: (result.stdout as string) || '',
      stderr: (result.stderr as string) || '',
    };
  }

  /**
   * Execute GPG encrypt command. Passphrase flows via stdin, never argv.
   */
  static encryptFile(filePath: string, passphrase: string): CommandResult {
    const args = [...this.gpgBaseArgs(), '-c', filePath];
    const result = this.runGpg(args, passphrase);
    if (result.status !== 0) {
      const reason =
        result.stderr.trim() || `gpg exited with code ${result.status}`;
      return {
        success: false,
        message: `Command failed: ${reason}`,
        errors: [reason],
      };
    }
    return {
      success: true,
      message: 'Command executed successfully',
      data: result.stdout,
    };
  }

  /**
   * Execute GPG decrypt command, writing the plaintext to `outputPath`.
   * Passphrase flows via stdin, never argv.
   */
  static decryptFile(
    encryptedPath: string,
    outputPath: string,
    passphrase: string
  ): CommandResult {
    const args = [...this.gpgBaseArgs(), '-o', outputPath, '-d', encryptedPath];
    const result = this.runGpg(args, passphrase);
    if (result.status !== 0) {
      const reason =
        result.stderr.trim() || `gpg exited with code ${result.status}`;
      return {
        success: false,
        message: `Command failed: ${reason}`,
        errors: [reason],
      };
    }
    return {
      success: true,
      message: 'Command executed successfully',
      data: result.stdout,
    };
  }

  /**
   * Decrypt a GPG file to an in-memory string. Never writes to disk.
   *
   * Uses spawnSync with an argument array AND pipes the passphrase via
   * stdin (`--passphrase-fd 0`). The passphrase is never visible via
   * `ps`, `/proc/<pid>/cmdline`, or auditd's execve logging — it flows
   * only through an anonymous pipe from this process to gpg.
   *
   * `--pinentry-mode loopback` tells gpg-agent to step aside and accept
   * the passphrase we're sending rather than popping up a GUI prompt.
   */
  static decryptFileToString(
    encryptedPath: string,
    passphrase: string
  ): { success: boolean; content?: string; error?: string } {
    const args = [...this.gpgBaseArgs(), '-d', encryptedPath];
    const result = this.runGpg(args, passphrase);
    if (result.status !== 0) {
      const reason =
        result.stderr.trim() || `gpg exited with code ${result.status}`;
      return { success: false, error: reason };
    }
    return { success: true, content: result.stdout };
  }

  /**
   * Spawn a sub-process with the supplied env, inheriting stdio.
   *
   * Forwards SIGINT / SIGTERM / SIGHUP from the parent process to the
   * sub-process so Ctrl-C cleanly propagates. Explicitly sets
   * `shell: false` — argv is passed literally, no shell interpolation,
   * no $VAR expansion in argv, no command chaining. Users who need
   * shell features must wrap their command explicitly (e.g.
   * `envx run -e prod -- sh -c 'cmd1 && cmd2'`).
   *
   * Resolves with the sub-process exit code. On signal termination,
   * re-raises the signal on the parent so the parent's wait-status
   * accurately reflects the cause. The caller is expected to feed the
   * resolved code into `process.exit(code)`.
   */
  static spawnChildWithEnv(
    args: string[],
    env: Record<string, string | undefined>,
    cwd: string
  ): Promise<number> {
    if (args.length === 0) {
      return Promise.reject(new Error('spawnChildWithEnv: empty args'));
    }

    return new Promise((resolve, reject) => {
      let sub: ChildProcess;
      try {
        sub = spawn(args[0], args.slice(1), {
          stdio: 'inherit',
          shell: false,
          env,
          cwd,
        });
      } catch (err) {
        reject(err);
        return;
      }

      const forward = (sig: string) => () => {
        if (sub && !sub.killed) {
          sub.kill(sig as Parameters<typeof sub.kill>[0]);
        }
      };
      const sigint = forward('SIGINT');
      const sigterm = forward('SIGTERM');
      const sighup = forward('SIGHUP');

      process.on('SIGINT', sigint);
      process.on('SIGTERM', sigterm);
      process.on('SIGHUP', sighup);

      const cleanup = () => {
        process.off('SIGINT', sigint);
        process.off('SIGTERM', sigterm);
        process.off('SIGHUP', sighup);
      };

      sub.on('error', (err: Error & { code?: string }) => {
        cleanup();
        reject(err);
      });

      sub.on('exit', (code, signal) => {
        cleanup();
        if (signal) {
          // Re-raise on the parent so our wait-status reflects the signal.
          process.kill(process.pid, signal);
          // Safety net in case the signal is ignored.
          resolve(128);
        } else {
          resolve(code ?? 0);
        }
      });
    });
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

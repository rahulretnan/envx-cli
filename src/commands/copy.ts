import chalk from 'chalk';
import { Command } from 'commander';
import path from 'path';
import { validateCopyOptions } from '../schemas';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';
import { InteractiveUtils } from '../utils/interactive';

export const createCopyCommand = (): Command => {
  const command = new Command('copy');

  command
    .description('Copy environment file from stage to .env')
    .option(
      '-e, --environment <env>',
      'Environment name (e.g., development, staging, production)'
    )
    .option('-p, --passphrase <passphrase>', 'Passphrase for decryption')
    .option('-s, --secret <secret>', 'Secret key from environment variable')
    .option('-c, --cwd <path>', 'Working directory path')
    .option('-a, --all', 'Process all directories with environment files')
    .option('--overwrite', 'Overwrite existing .env file without confirmation')
    .action(async options => {
      try {
        await executeCopy(options);
      } catch (error) {
        CliUtils.error(
          `Copy failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return command;
};

async function executeCopy(rawOptions: any): Promise<void> {
  CliUtils.header('Environment File Copy');

  // Validate --all flag compatibility (copy has different logic than encrypt/decrypt)
  if (rawOptions.all) {
    if (!rawOptions.environment) {
      throw new Error(
        'The --all flag requires an environment to be specified with -e/--environment'
      );
    }
  }

  // Get working directory
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();

  // Find all available environments for validation
  const availableEnvironments = await FileUtils.findAllEnvironments(cwd);

  if (availableEnvironments.length === 0) {
    CliUtils.warning('No environment files found in the current directory.');
    CliUtils.info(
      'Use the "create" command to create environment files first.'
    );
    return;
  }

  // Handle --all flag first (similar to encrypt/decrypt pattern)
  if (rawOptions.all) {
    await processAllDirectories(rawOptions, rawOptions.environment, cwd);
    return;
  }

  let environment: string = rawOptions.environment || '';

  // Interactive environment selection if not provided (single directory mode)
  if (!environment) {
    if (availableEnvironments.length === 1) {
      environment = availableEnvironments[0];
      CliUtils.info(
        `Using environment: ${CliUtils.formatEnvironment(environment)}`
      );
    } else {
      environment = await InteractiveUtils.selectEnvironment(
        availableEnvironments,
        'Select environment to copy to .env:'
      );
    }
  }

  // Validate environment exists
  if (!availableEnvironments.includes(environment)) {
    throw new Error(
      `Environment '${environment}' not found. Available: ${availableEnvironments.join(', ')}`
    );
  }

  await processSingleEnvironment(rawOptions, environment, cwd);
}

async function processSingleEnvironment(
  rawOptions: any,
  environment: string,
  cwd: string,
  isPartOfAll: boolean = false
): Promise<{ success: boolean; error?: string }> {
  // Find environment files
  const envFiles = await FileUtils.findEnvFiles(environment, cwd);
  const sourceFiles = envFiles.filter(file => file.exists);

  if (sourceFiles.length === 0) {
    const message = `No files found for environment '${environment}'`;
    if (!isPartOfAll) {
      CliUtils.error(message);
    }
    return { success: false, error: message };
  }

  // Determine source file (prefer unencrypted, then encrypted)
  let sourceFile = sourceFiles.find(file => !file.encrypted);
  let isEncrypted = false;

  if (!sourceFile) {
    sourceFile = sourceFiles.find(file => file.encrypted);
    isEncrypted = true;
  }

  if (!sourceFile) {
    const message = `No valid source file found for environment '${environment}'`;
    if (!isPartOfAll) {
      CliUtils.error(message);
    }
    return { success: false, error: message };
  }

  const sourcePath = isEncrypted
    ? FileUtils.getEncryptedPath(sourceFile.path)
    : sourceFile.path;
  const targetPath = path.join(cwd, '.env');

  if (!isPartOfAll) {
    CliUtils.info(
      `Source: ${CliUtils.formatPath(FileUtils.getRelativePath(sourcePath, cwd), cwd)}`
    );
    CliUtils.info(
      `Target: ${CliUtils.formatPath(FileUtils.getRelativePath(targetPath, cwd), cwd)}`
    );

    if (isEncrypted) {
      CliUtils.info(`File is encrypted - will decrypt during copy`);
    }
  } else {
    CliUtils.info(
      `Copying ${isEncrypted ? 'encrypted' : ''} ${FileUtils.getRelativePath(sourcePath, cwd)} → .env`
    );
  }

  // Validate source file exists
  if (!(await FileUtils.fileExists(sourcePath))) {
    const message = `Source file not found: ${sourcePath}`;
    if (!isPartOfAll) {
      CliUtils.error(message);
    }
    return { success: false, error: message };
  }

  // Check if target file exists
  const targetExists = await FileUtils.fileExists(targetPath);
  if (targetExists && !rawOptions.overwrite && !isPartOfAll) {
    CliUtils.warning('Target .env file already exists');

    // Show current .env info
    try {
      const currentSize = (await FileUtils.getFileStats(targetPath)).size;
      console.log(`Current .env file size: ${currentSize} bytes`);
    } catch {
      // Ignore error getting file stats
    }

    const confirm = await InteractiveUtils.confirmOperation(
      'Do you want to overwrite the existing .env file?',
      false
    );

    if (!confirm) {
      CliUtils.info('Operation cancelled.');
      return { success: false, error: 'Operation cancelled by user' };
    }
  }

  // Handle decryption if needed
  if (isEncrypted) {
    // Check prerequisites for encrypted files
    if (!ExecUtils.isGpgAvailable()) {
      const message =
        'GPG is not available. Please install GPG to decrypt files.';
      if (!isPartOfAll) {
        CliUtils.error(message);
        InteractiveUtils.displayPrerequisites();
        process.exit(1);
      } else {
        throw new Error(message);
      }
    }

    let passphrase: string = rawOptions.passphrase || '';

    // Get passphrase if not provided
    if (!passphrase || passphrase.trim() === '') {
      // Try to get from .envrc file
      const envrcConfig = await FileUtils.readEnvrc(cwd);
      const secretVar = FileUtils.generateSecretVariableName(environment);

      if (rawOptions.secret && envrcConfig[rawOptions.secret]) {
        passphrase = envrcConfig[rawOptions.secret];
        CliUtils.info(
          `Using secret from .envrc: ${chalk.cyan(rawOptions.secret)}`
        );
      } else if (envrcConfig[secretVar]) {
        passphrase = envrcConfig[secretVar];
        CliUtils.info(`Using secret from .envrc: ${chalk.cyan(secretVar)}`);
      } else {
        passphrase = await InteractiveUtils.promptPassphrase(
          `Enter decryption passphrase for ${CliUtils.formatEnvironment(environment)}:`
        );
      }
    }

    // Validate options
    validateCopyOptions({
      environment,
      passphrase,
      cwd,
      overwrite: rawOptions.overwrite,
    });

    // Test GPG operation
    if (!isPartOfAll) {
      CliUtils.info('Testing GPG operation...');
    }
    const gpgTest = ExecUtils.testGpgOperation(passphrase);
    if (!gpgTest.success) {
      throw new Error(`GPG test failed: ${gpgTest.message}`);
    }
    if (!isPartOfAll) {
      CliUtils.success('GPG test passed');
    }

    // Create backup if target exists
    let backupPath: string | null = null;
    if (targetExists) {
      backupPath = await FileUtils.createBackup(targetPath);
      if (!isPartOfAll) {
        CliUtils.info(
          `Created backup: ${chalk.gray(FileUtils.getRelativePath(backupPath, cwd))}`
        );
      }
    }

    // Decrypt to target
    if (!isPartOfAll) {
      CliUtils.info('Decrypting and copying...');
    }

    try {
      const decryptResult = ExecUtils.decryptFile(
        sourcePath,
        targetPath,
        passphrase
      );

      if (decryptResult.success) {
        CliUtils.success(`Successfully copied and decrypted to .env`);

        // Remove backup if successful
        if (backupPath) {
          await FileUtils.removeBackup(backupPath);
        }
      } else {
        // Restore backup if decryption failed
        if (backupPath) {
          ExecUtils.moveFile(backupPath, targetPath);
          CliUtils.info('Restored original .env file from backup');
        }

        CliUtils.error(`Failed to decrypt: ${decryptResult.message}`);
        if (decryptResult.errors) {
          decryptResult.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
        }
        if (!isPartOfAll) {
          process.exit(1);
        } else {
          return { success: false, error: decryptResult.message };
        }
      }
    } catch (error) {
      // Restore backup on error
      if (backupPath) {
        try {
          ExecUtils.moveFile(backupPath, targetPath);
          CliUtils.info('Restored original .env file from backup');
        } catch {
          // Ignore backup restore errors
        }
      }
      throw error;
    }
  } else {
    // Simple copy for unencrypted files
    validateCopyOptions({
      environment,
      cwd,
      overwrite: rawOptions.overwrite,
    });

    if (!isPartOfAll) {
      CliUtils.info('Copying file...');
    }

    try {
      const copyResult = ExecUtils.copyFile(sourcePath, targetPath);

      if (copyResult.success) {
        CliUtils.success(`Successfully copied to .env`);
      } else {
        CliUtils.error(`Failed to copy: ${copyResult.message}`);
        if (copyResult.errors) {
          copyResult.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
        }
        if (!isPartOfAll) {
          process.exit(1);
        } else {
          return { success: false, error: copyResult.message };
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      CliUtils.error(`Error copying file: ${errorMessage}`);
      if (!isPartOfAll) {
        process.exit(1);
      } else {
        return { success: false, error: errorMessage };
      }
    }
  }

  // Show final status (only for single environment mode)
  if (!isPartOfAll) {
    console.log();
    CliUtils.subheader('Copy Summary');

    try {
      const targetStats = await FileUtils.getFileStats(targetPath);
      console.log(
        `Target file: ${CliUtils.formatPath('.env', cwd)} (${targetStats.size} bytes)`
      );
    } catch {
      console.log(`Target file: ${CliUtils.formatPath('.env', cwd)}`);
    }

    // Show usage information
    console.log();
    CliUtils.info('Next steps:');
    console.log(chalk.gray('• Review the .env file contents'));
    console.log(chalk.gray('• Your application can now use the .env file'));
    console.log(
      chalk.gray('• Remember: .env files should be added to .gitignore')
    );

    // Security warning for production
    if (['production', 'prod'].includes(environment.toLowerCase())) {
      console.log();
      CliUtils.warning('Security Notice:');
      console.log(
        chalk.yellow('You are using production environment variables locally.')
      );
      console.log(
        chalk.yellow(
          'Ensure this .env file is not committed to version control.'
        )
      );
    }
  }

  return { success: true };
}

async function processAllDirectories(
  rawOptions: any,
  environment: string,
  cwd: string
): Promise<void> {
  CliUtils.info(
    `Processing all directories for environment: ${CliUtils.formatEnvironment(environment)}`
  );

  // Find all environment files for this environment using consistent pattern
  const allEnvFiles = await FileUtils.findEnvFiles(environment, cwd);
  const existingFiles = allEnvFiles.filter(file => file.exists);

  if (existingFiles.length === 0) {
    CliUtils.warning(
      `No ${CliUtils.formatEnvironment(environment)} files found in the project.`
    );
    return;
  }

  // Group files by directory
  const filesByDirectory = new Map<string, typeof existingFiles>();
  for (const file of existingFiles) {
    const dir = path.dirname(file.path);
    if (!filesByDirectory.has(dir)) {
      filesByDirectory.set(dir, []);
    }
    filesByDirectory.get(dir)!.push(file);
  }

  const directories = Array.from(filesByDirectory.keys()).sort();

  CliUtils.info(
    `Found ${CliUtils.formatEnvironment(environment)} files in ${directories.length} director${directories.length === 1 ? 'y' : 'ies'}:`
  );
  directories.forEach(dir => {
    const relativePath = FileUtils.getRelativePath(dir, cwd);
    const displayDir = relativePath === '' ? '.' : relativePath;
    console.log(`  • ${CliUtils.formatPath(displayDir, cwd)}`);
  });

  let totalSuccess = 0;
  let totalErrors = 0;
  const results: Array<{
    directory: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const directory of directories) {
    console.log();
    const relativeDir = FileUtils.getRelativePath(directory, cwd);
    const displayDir = relativeDir === '' ? '.' : relativeDir;
    CliUtils.subheader(
      `Processing Directory: ${CliUtils.formatPath(displayDir, cwd)}`
    );

    try {
      const result = await processSingleEnvironment(
        rawOptions,
        environment,
        directory,
        true // isPartOfAll flag
      );

      if (result.success) {
        results.push({ directory: displayDir, success: true });
        totalSuccess++;
      } else {
        results.push({
          directory: displayDir,
          success: false,
          error: result.error || 'Unknown error',
        });
        totalErrors++;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      CliUtils.error(
        `Failed to process directory '${displayDir}': ${errorMessage}`
      );
      results.push({
        directory: displayDir,
        success: false,
        error: errorMessage,
      });
      totalErrors++;
    }
  }

  // Final summary for all directories
  console.log();
  CliUtils.header('Overall Summary');

  results.forEach(result => {
    if (result.success) {
      console.log(
        `${CliUtils.formatPath(result.directory, cwd)}: ${chalk.green('✓ Success')}`
      );
    } else {
      console.log(
        `${CliUtils.formatPath(result.directory, cwd)}: ${chalk.red('✗ Failed')} - ${result.error}`
      );
    }
  });

  console.log();
  if (totalSuccess > 0) {
    CliUtils.success(
      `Total: Successfully copied ${CliUtils.formatEnvironment(environment)} to .env in ${totalSuccess} director${totalSuccess === 1 ? 'y' : 'ies'}`
    );
  }

  if (totalErrors > 0) {
    CliUtils.error(
      `Total: Failed to copy in ${totalErrors} director${totalErrors === 1 ? 'y' : 'ies'}`
    );
  }

  // Show next steps
  if (totalSuccess > 0) {
    console.log();
    CliUtils.info('Next steps:');
    console.log(chalk.gray('• Review the .env files in each directory'));
    console.log(chalk.gray('• Your applications can now use the .env files'));
    console.log(
      chalk.gray('• Remember: .env files should be added to .gitignore')
    );

    // Security warning for production
    if (['production', 'prod'].includes(environment.toLowerCase())) {
      console.log();
      CliUtils.warning('Security Notice:');
      console.log(
        chalk.yellow(
          'You are using production environment variables across multiple services.'
        )
      );
      console.log(
        chalk.yellow('Ensure .env files are not committed to version control.')
      );
    }
  }

  if (totalErrors > 0) {
    process.exit(1);
  }
}

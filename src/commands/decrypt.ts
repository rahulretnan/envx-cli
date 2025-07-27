import chalk from 'chalk';
import { Command } from 'commander';
import { validateDecryptOptions } from '../schemas';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';
import { InteractiveUtils } from '../utils/interactive';

export const createDecryptCommand = (): Command => {
  const command = new Command('decrypt');

  command
    .description('Decrypt environment files')
    .option(
      '-e, --environment <env>',
      'Environment name (e.g., development, staging, production)'
    )
    .option('-p, --passphrase <passphrase>', 'Passphrase for decryption')
    .option('-s, --secret <secret>', 'Secret key from environment variable')
    .option('-c, --cwd <path>', 'Working directory path')
    .option('-i, --interactive', 'Interactive mode for selecting files')
    .option(
      '--overwrite',
      'Overwrite existing decrypted files without confirmation'
    )
    .action(async options => {
      try {
        await executeDecrypt(options);
      } catch (error) {
        CliUtils.error(
          `Decryption failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return command;
};

async function executeDecrypt(rawOptions: any): Promise<void> {
  CliUtils.header('Environment File Decryption');

  // Get working directory
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();

  // Check prerequisites
  if (!ExecUtils.isGpgAvailable()) {
    CliUtils.error(
      'GPG is not available. Please install GPG to use decryption features.'
    );
    InteractiveUtils.displayPrerequisites();
    process.exit(1);
  }

  // Find all available environments if not specified
  const availableEnvironments = await FileUtils.findAllEnvironments(cwd);

  if (availableEnvironments.length === 0) {
    CliUtils.warning('No environment files found in the current directory.');
    CliUtils.info(
      'Use the "create" command to create environment files first.'
    );
    return;
  }

  let environment = rawOptions.environment;
  let passphrase = rawOptions.passphrase;

  // Interactive environment selection if not provided
  if (!environment) {
    if (availableEnvironments.length === 1) {
      environment = availableEnvironments[0];
      CliUtils.info(
        `Using environment: ${CliUtils.formatEnvironment(environment)}`
      );
    } else {
      environment = await InteractiveUtils.selectEnvironment(
        availableEnvironments,
        'Select environment to decrypt:'
      );
    }
  }

  // Validate environment exists
  if (!availableEnvironments.includes(environment)) {
    throw new Error(
      `Environment '${environment}' not found. Available: ${availableEnvironments.join(', ')}`
    );
  }

  // Get passphrase
  if (!passphrase) {
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
        'Enter decryption passphrase:'
      );
    }
  }

  // Validate options
  validateDecryptOptions({
    environment,
    passphrase,
    cwd,
    secret: rawOptions.secret,
  });

  // Test GPG operation
  CliUtils.info('Testing GPG operation...');
  const gpgTest = ExecUtils.testGpgOperation(passphrase);
  if (!gpgTest.success) {
    throw new Error(`GPG test failed: ${gpgTest.message}`);
  }
  CliUtils.success('GPG test passed');

  // Find encrypted environment files
  const envFiles = await FileUtils.findEnvFiles(environment, cwd);
  const encryptedFiles = envFiles.filter(file => file.encrypted && file.exists);

  if (encryptedFiles.length === 0) {
    CliUtils.warning(
      `No encrypted .env.${environment}.gpg files found to decrypt.`
    );
    CliUtils.info(
      'Use the "encrypt" command to encrypt environment files first.'
    );
    return;
  }

  CliUtils.info(`Found ${encryptedFiles.length} encrypted file(s) to decrypt:`);
  encryptedFiles.forEach(file => {
    const encryptedPath = FileUtils.getEncryptedPath(file.path);
    console.log(`  • ${CliUtils.formatPath(encryptedPath, cwd)}`);
  });

  // Interactive file selection if requested
  let filesToProcess = encryptedFiles;
  if (rawOptions.interactive && encryptedFiles.length > 1) {
    const selectedPaths = await InteractiveUtils.selectFiles(
      encryptedFiles.map(f =>
        FileUtils.getRelativePath(FileUtils.getEncryptedPath(f.path), cwd)
      ),
      'Select files to decrypt:'
    );
    filesToProcess = encryptedFiles.filter(file => {
      const encryptedPath = FileUtils.getEncryptedPath(file.path);
      return selectedPaths.includes(
        FileUtils.getRelativePath(encryptedPath, cwd)
      );
    });
  }

  if (filesToProcess.length === 0) {
    CliUtils.info('No files selected for decryption.');
    return;
  }

  // Check for existing decrypted files and warn if overwrite not specified
  const conflictFiles: string[] = [];
  for (const envFile of filesToProcess) {
    if (await FileUtils.fileExists(envFile.path)) {
      conflictFiles.push(envFile.path);
    }
  }

  if (conflictFiles.length > 0 && !rawOptions.overwrite) {
    CliUtils.warning(
      `The following files already exist and will be overwritten:`
    );
    conflictFiles.forEach(file => {
      console.log(`  • ${CliUtils.formatPath(file, cwd)}`);
    });

    const confirm = await InteractiveUtils.confirmOperation(
      'Continue and overwrite existing files?',
      false
    );

    if (!confirm) {
      CliUtils.info('Operation cancelled.');
      return;
    }
  }

  // Confirm operation
  if (!rawOptions.interactive && conflictFiles.length === 0) {
    const confirm = await InteractiveUtils.confirmOperation(
      `Decrypt ${filesToProcess.length} file(s) for ${CliUtils.formatEnvironment(environment)}?`
    );
    if (!confirm) {
      CliUtils.info('Operation cancelled.');
      return;
    }
  }

  CliUtils.subheader('Decrypting Files');

  let successCount = 0;
  let errorCount = 0;

  for (const envFile of filesToProcess) {
    const encryptedPath = FileUtils.getEncryptedPath(envFile.path);
    const relativePath = FileUtils.getRelativePath(envFile.path, cwd);
    const relativeEncryptedPath = FileUtils.getRelativePath(encryptedPath, cwd);

    console.log();
    CliUtils.info(`Processing: ${chalk.cyan(relativeEncryptedPath)}`);

    try {
      // Create backup if file exists
      let backupPath: string | null = null;
      if (await FileUtils.fileExists(envFile.path)) {
        backupPath = await FileUtils.createBackup(envFile.path);
        CliUtils.info(
          `Created backup: ${chalk.gray(FileUtils.getRelativePath(backupPath, cwd))}`
        );
      }

      // Decrypt the file
      const decryptResult = ExecUtils.decryptFile(
        encryptedPath,
        envFile.path,
        passphrase
      );

      if (decryptResult.success) {
        CliUtils.success(`Decrypted: ${chalk.cyan(relativePath)}`);

        // Remove backup if decryption was successful
        if (backupPath) {
          await FileUtils.removeBackup(backupPath);
        }

        successCount++;
      } else {
        // Restore backup if decryption failed
        if (backupPath) {
          ExecUtils.moveFile(backupPath, envFile.path);
          CliUtils.info('Restored original file from backup');
        }

        CliUtils.error(`Failed to decrypt: ${decryptResult.message}`);
        if (decryptResult.errors) {
          decryptResult.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
        }
        errorCount++;
      }
    } catch (error) {
      CliUtils.error(
        `Error processing ${relativeEncryptedPath}: ${error instanceof Error ? error.message : String(error)}`
      );
      errorCount++;
    }
  }

  // Final summary
  console.log();
  CliUtils.subheader('Decryption Summary');

  if (successCount > 0) {
    CliUtils.success(`Successfully decrypted ${successCount} file(s)`);
  }

  if (errorCount > 0) {
    CliUtils.error(`Failed to decrypt ${errorCount} file(s)`);
  }

  // Show next steps
  if (successCount > 0) {
    console.log();
    CliUtils.info('Next steps:');
    console.log(chalk.gray('• Review the decrypted environment files'));
    console.log(
      chalk.gray('• Remember: decrypted files contain sensitive data')
    );
    console.log(
      chalk.gray('• Consider re-encrypting files when done: envx encrypt')
    );
    console.log(
      chalk.gray('• Never commit decrypted .env files to version control')
    );
  }

  // Show security warning
  if (successCount > 0) {
    console.log();
    CliUtils.warning('Security Notice:');
    console.log(chalk.yellow('Decrypted files contain sensitive information.'));
    console.log(
      chalk.yellow(
        'Ensure they are not accidentally committed to version control.'
      )
    );
  }

  if (errorCount > 0) {
    process.exit(1);
  }
}

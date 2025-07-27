import chalk from 'chalk';
import { Command } from 'commander';
import { validateEncryptOptions } from '../schemas';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';
import { InteractiveUtils } from '../utils/interactive';

export const createEncryptCommand = (): Command => {
  const command = new Command('encrypt');

  command
    .description('Encrypt environment files')
    .option(
      '-e, --environment <env>',
      'Environment name (e.g., development, staging, production)'
    )
    .option('-p, --passphrase <passphrase>', 'Passphrase for encryption')
    .option('-s, --secret <secret>', 'Secret key from environment variable')
    .option('-c, --cwd <path>', 'Working directory path')
    .option('-i, --interactive', 'Interactive mode for selecting files')
    .option('-a, --all', 'Process all available environments')
    .action(async options => {
      try {
        await executeEncrypt(options);
      } catch (error) {
        CliUtils.error(
          `Encryption failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return command;
};

async function executeEncrypt(rawOptions: any): Promise<void> {
  CliUtils.header('Environment File Encryption');

  // Validate --all flag compatibility
  if (rawOptions.all) {
    if (rawOptions.environment) {
      throw new Error('Cannot use --all with --environment flag');
    }
    if (rawOptions.interactive) {
      throw new Error('Interactive mode is not compatible with --all flag');
    }
  }

  // Get working directory
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();

  // Check prerequisites
  if (!ExecUtils.isGpgAvailable()) {
    CliUtils.error(
      'GPG is not available. Please install GPG to use encryption features.'
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

  // Handle --all flag
  if (rawOptions.all) {
    await processAllEnvironments(rawOptions, availableEnvironments, cwd);
    return;
  }

  let environment: string = rawOptions.environment || '';

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
        'Select environment to encrypt:'
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

async function processAllEnvironments(
  rawOptions: any,
  environments: string[],
  cwd: string
): Promise<void> {
  CliUtils.info(
    `Processing ${environments.length} environment(s): ${environments.map(env => CliUtils.formatEnvironment(env)).join(', ')}`
  );

  let totalSuccess = 0;
  let totalErrors = 0;
  const results: Array<{
    environment: string;
    success: number;
    errors: number;
  }> = [];

  for (const environment of environments) {
    console.log();
    CliUtils.subheader(
      `Processing Environment: ${CliUtils.formatEnvironment(environment)}`
    );

    try {
      const result = await processSingleEnvironment(
        rawOptions,
        environment,
        cwd,
        true
      );
      results.push({
        environment,
        success: result.successCount,
        errors: result.errorCount,
      });
      totalSuccess += result.successCount;
      totalErrors += result.errorCount;
    } catch (error) {
      CliUtils.error(
        `Failed to process environment '${environment}': ${error instanceof Error ? error.message : String(error)}`
      );
      results.push({ environment, success: 0, errors: 1 });
      totalErrors++;
    }
  }

  // Final summary for all environments
  console.log();
  CliUtils.header('Overall Summary');

  results.forEach(result => {
    if (result.success > 0 || result.errors > 0) {
      console.log(
        `${CliUtils.formatEnvironment(result.environment)}: ${chalk.green(`${result.success} success`)} | ${chalk.red(`${result.errors} errors`)}`
      );
    }
  });

  console.log();
  if (totalSuccess > 0) {
    CliUtils.success(
      `Total: Successfully encrypted ${totalSuccess} file(s) across all environments`
    );
  }

  if (totalErrors > 0) {
    CliUtils.error(
      `Total: Failed to encrypt ${totalErrors} file(s) across all environments`
    );
  }

  // Show next steps
  if (totalSuccess > 0) {
    console.log();
    CliUtils.info('Next steps:');
    console.log(chalk.gray('• Add *.gpg files to your version control'));
    console.log(chalk.gray('• Consider adding .env.* files to .gitignore'));
    console.log(
      chalk.gray('• Use "envx decrypt" to decrypt files when needed')
    );
  }

  if (totalErrors > 0) {
    process.exit(1);
  }
}

async function processSingleEnvironment(
  rawOptions: any,
  environment: string,
  cwd: string,
  isPartOfAll: boolean = false
): Promise<{ successCount: number; errorCount: number }> {
  let passphrase: string = rawOptions.passphrase || '';

  // Get passphrase
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
      const promptMessage = isPartOfAll
        ? `Enter encryption passphrase for ${CliUtils.formatEnvironment(environment)}:`
        : 'Enter encryption passphrase:';
      passphrase = await InteractiveUtils.promptPassphrase(promptMessage);
    }
  }

  // Validate options
  if (!isPartOfAll) {
    validateEncryptOptions({
      environment,
      passphrase,
      cwd,
      secret: rawOptions.secret,
    });
  }

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

  // Find environment files
  const envFiles = await FileUtils.findEnvFiles(environment, cwd);
  const unencryptedFiles = envFiles.filter(
    file => !file.encrypted && file.exists
  );

  if (unencryptedFiles.length === 0) {
    CliUtils.warning(
      `No unencrypted .env.${environment} files found to encrypt.`
    );
    return { successCount: 0, errorCount: 0 };
  }

  if (!isPartOfAll) {
    CliUtils.info(`Found ${unencryptedFiles.length} file(s) to encrypt:`);
    unencryptedFiles.forEach(file => {
      console.log(`  • ${CliUtils.formatPath(file.path, cwd)}`);
    });
  } else {
    CliUtils.info(`Found ${unencryptedFiles.length} file(s) to encrypt`);
  }

  // Interactive file selection if requested (skip for --all)
  let filesToProcess = unencryptedFiles;
  if (rawOptions.interactive && unencryptedFiles.length > 1 && !isPartOfAll) {
    const selectedPaths = await InteractiveUtils.selectFiles(
      unencryptedFiles.map(f => FileUtils.getRelativePath(f.path, cwd)),
      'Select files to encrypt:'
    );
    filesToProcess = unencryptedFiles.filter(file =>
      selectedPaths.includes(FileUtils.getRelativePath(file.path, cwd))
    );
  }

  if (filesToProcess.length === 0) {
    CliUtils.info('No files selected for encryption.');
    return { successCount: 0, errorCount: 0 };
  }

  // Confirm operation (skip for --all)
  if (!rawOptions.interactive && !isPartOfAll) {
    const confirm = await InteractiveUtils.confirmOperation(
      `Encrypt ${filesToProcess.length} file(s) for ${CliUtils.formatEnvironment(environment)}?`
    );
    if (!confirm) {
      CliUtils.info('Operation cancelled.');
      return { successCount: 0, errorCount: 0 };
    }
  }

  if (!isPartOfAll) {
    CliUtils.subheader('Encrypting Files');
  }

  let successCount = 0;
  let errorCount = 0;

  for (const envFile of filesToProcess) {
    const relativePath = FileUtils.getRelativePath(envFile.path, cwd);
    console.log();
    CliUtils.info(`Processing: ${chalk.cyan(relativePath)}`);

    try {
      // Check if encrypted version already exists
      const encryptedPath = FileUtils.getEncryptedPath(envFile.path);
      const encryptedExists = await FileUtils.fileExists(encryptedPath);

      if (encryptedExists) {
        // Compare with existing encrypted version
        const tempDecryptedPath = `${envFile.path}.temp.${Date.now()}`;

        try {
          const decryptResult = ExecUtils.decryptFile(
            encryptedPath,
            tempDecryptedPath,
            passphrase
          );

          if (decryptResult.success) {
            const filesIdentical = await FileUtils.filesAreIdentical(
              envFile.path,
              tempDecryptedPath
            );

            // Cleanup temp file
            if (await FileUtils.fileExists(tempDecryptedPath)) {
              ExecUtils.removeFile(tempDecryptedPath);
            }

            if (filesIdentical) {
              CliUtils.success(
                'File already encrypted with same content - skipping'
              );
              successCount++;
              continue;
            } else {
              CliUtils.warning('File has changes - updating encrypted version');
            }
          } else {
            CliUtils.warning(
              'Could not decrypt existing file - creating new encrypted version'
            );
          }
        } catch {
          // Cleanup temp file on error
          if (await FileUtils.fileExists(tempDecryptedPath)) {
            ExecUtils.removeFile(tempDecryptedPath);
          }
          CliUtils.warning(
            'Error comparing with existing encrypted file - proceeding with encryption'
          );
        }
      }

      // Encrypt the file
      const encryptResult = ExecUtils.encryptFile(envFile.path, passphrase);

      if (encryptResult.success) {
        CliUtils.success(`Encrypted: ${chalk.cyan(relativePath)}`);
        CliUtils.info(`Created: ${chalk.cyan(`${relativePath}.gpg`)}`);
        successCount++;
      } else {
        CliUtils.error(`Failed to encrypt: ${encryptResult.message}`);
        if (encryptResult.errors) {
          encryptResult.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
        }
        errorCount++;
      }
    } catch (error) {
      CliUtils.error(
        `Error processing ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
      errorCount++;
    }
  }

  // Final summary (only for single environment mode)
  if (!isPartOfAll) {
    console.log();
    CliUtils.subheader('Encryption Summary');

    if (successCount > 0) {
      CliUtils.success(`Successfully encrypted ${successCount} file(s)`);
    }

    if (errorCount > 0) {
      CliUtils.error(`Failed to encrypt ${errorCount} file(s)`);
    }

    // Show next steps
    if (successCount > 0) {
      console.log();
      CliUtils.info('Next steps:');
      console.log(chalk.gray('• Add *.gpg files to your version control'));
      console.log(chalk.gray('• Consider adding .env.* files to .gitignore'));
      console.log(
        chalk.gray('• Use "envx decrypt" to decrypt files when needed')
      );
    }

    if (errorCount > 0) {
      process.exit(1);
    }
  }

  return { successCount, errorCount };
}

#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import path from 'path';
import { createCopyCommand } from './commands/copy';
import { createCreateCommand } from './commands/create';
import { createDecryptCommand } from './commands/decrypt';
import { createConfigCommand } from './commands/config';
import { createEncryptCommand, encryptEnvironment } from './commands/encrypt';
import { createFilesCommand, getRegisteredFileStatus } from './commands/files';
import {
  createInteractiveCommand,
  showQuickStart,
} from './commands/interactive';
import { createRunCommand } from './commands/run';
import { createSkillCommand } from './commands/skill';
import { ExitCode } from './types';
import { CliUtils, ExecUtils } from './utils/exec';
import { FileUtils } from './utils/file';
import { InteractiveUtils } from './utils/interactive';

// Package information
import * as packageJson from '../package.json';

async function createProgram(): Promise<Command> {
  const program = new Command();

  program
    .name('envx')
    .description('Environment file encryption and management tool')
    .version(packageJson.version)
    .option('-v, --verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress non-error output')
    .hook('preAction', async thisCommand => {
      // Global setup
      const options = thisCommand.opts();

      if (options.quiet) {
        // Override console.log for quiet mode (but keep error output)
        const originalLog = console.log;
        console.log = (...args: any[]) => {
          // Only suppress non-error messages
          if (!args.some(arg => typeof arg === 'string' && arg.includes('✗'))) {
            return;
          }
          originalLog(...args);
        };
      }
    });

  // Add commands
  program.addCommand(createEncryptCommand());
  program.addCommand(createDecryptCommand());
  program.addCommand(createCreateCommand());
  program.addCommand(createCopyCommand());
  program.addCommand(createInteractiveCommand());
  program.addCommand(createConfigCommand());
  program.addCommand(createRunCommand());
  program.addCommand(createFilesCommand());
  program.addCommand(createSkillCommand());

  // List command to show environment status
  program
    .command('list')
    .alias('ls')
    .description('List all environment files and their status')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeList(options);
      } catch (error) {
        CliUtils.error(
          `List failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  // Status command to show overall project status
  program
    .command('status')
    .description('Show project encryption status and recommendations')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeStatus(options);
      } catch (error) {
        CliUtils.error(
          `Status check failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  // Init command for quick project setup
  program
    .command('init')
    .description('Initialize EnvX in a new project')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeInit(options);
      } catch (error) {
        CliUtils.error(
          `Initialization failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  // Version command override to show more info
  program
    .command('version')
    .description('Show version information')
    .action(() => {
      console.log();
      console.log(chalk.bold.cyan('🔐 EnvX'));
      console.log(`Version: ${chalk.green(packageJson.version)}`);
      console.log(
        `Description: ${packageJson.description || 'Environment file encryption and management tool'}`
      );
      console.log();
      console.log('Dependencies:');
      console.log(
        `• GPG: ${ExecUtils.isGpgAvailable() ? chalk.green('Available') : chalk.red('Not found')}`
      );
      console.log(`• Node.js: ${chalk.green(process.version)}`);
      console.log();
    });

  return program;
}

async function executeList(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  CliUtils.header('Environment Files');

  const environments = await FileUtils.findAllEnvironments(cwd);
  // Load the registry up front — a files-only project (no .env.* at all)
  // must still show its registered files instead of bailing out.
  const { root: filesRoot, entries: registered } =
    await FileUtils.getRegisteredFiles(cwd);

  if (environments.length === 0 && registered.length === 0) {
    CliUtils.warning('No environment files found in the current directory.');
    console.log();
    CliUtils.info('To get started:');
    console.log(chalk.cyan('  envx init'));
    console.log(chalk.cyan('  envx create -i'));
    return;
  }

  if (environments.length === 0) {
    CliUtils.warning('No environment files found in the current directory.');
  }

  const tableRows: string[][] = [];

  for (const env of environments.sort()) {
    const envFiles = await FileUtils.findEnvFiles(env, cwd);

    for (const file of envFiles) {
      const displayPath = file.encrypted
        ? FileUtils.getEncryptedPath(file.path)
        : file.path;

      const relativePath = FileUtils.getRelativePath(displayPath, cwd);
      const status = file.encrypted
        ? chalk.green('Encrypted')
        : chalk.yellow('Unencrypted');
      const type = file.encrypted ? '.gpg' : '.env';

      tableRows.push([
        CliUtils.formatEnvironment(env),
        chalk.cyan(relativePath),
        type,
        status,
      ]);
    }
  }

  if (tableRows.length > 0) {
    CliUtils.printTable(
      ['Environment', 'File Path', 'Type', 'Status'],
      tableRows
    );
  }

  // Show .envrc status
  console.log();
  const envrcExists = await FileUtils.fileExists(path.join(cwd, '.envrc'));
  CliUtils.info(
    `Secrets file (.envrc): ${envrcExists ? chalk.green('Present') : chalk.yellow('Not found')}`
  );

  if (!envrcExists) {
    console.log(chalk.gray('  Use "envx interactive" to set up secrets'));
  }

  // Registered files section
  if (registered.length > 0) {
    console.log();
    CliUtils.subheader('Registered Files');
    const fileRows: string[][] = [];
    for (const entry of registered) {
      const status = await getRegisteredFileStatus(filesRoot, entry);
      fileRows.push([
        chalk.cyan(entry.path),
        entry.stage
          ? CliUtils.formatEnvironment(entry.stage)
          : chalk.gray('global'),
        status.label,
      ]);
    }
    CliUtils.printTable(['Path', 'Stage', 'Status'], fileRows);
  }
}

async function executeStatus(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  CliUtils.header('Project Status');

  // Check prerequisites
  CliUtils.subheader('Prerequisites');
  console.log(
    `GPG: ${ExecUtils.isGpgAvailable() ? chalk.green('✓ Available') : chalk.red('✗ Not found')}`
  );

  if (!ExecUtils.isGpgAvailable()) {
    InteractiveUtils.displayPrerequisites();
    return;
  }

  // Environment files status
  const environments = await FileUtils.findAllEnvironments(cwd);
  // Load the registry up front — a files-only project (no .env.* at all)
  // must still report its registered files instead of bailing out.
  const { root: filesRoot, entries: registered } =
    await FileUtils.getRegisteredFiles(cwd);

  if (environments.length === 0 && registered.length === 0) {
    CliUtils.warning('No environment files found.');
    console.log();
    CliUtils.info('Recommendations:');
    console.log(chalk.yellow('• Run "envx init" to get started'));
    console.log(chalk.yellow('• Create environment files with "envx create"'));
    return;
  }

  const recommendations: string[] = [];

  if (environments.length === 0) {
    CliUtils.warning('No environment files found.');
  } else {
    CliUtils.subheader('Environment Summary');

    let totalFiles = 0;
    let encryptedFiles = 0;
    let unencryptedFiles = 0;

    for (const env of environments) {
      const envFiles = await FileUtils.findEnvFiles(env, cwd);
      const encrypted = envFiles.filter(f => f.encrypted).length;
      const unencrypted = envFiles.filter(f => !f.encrypted).length;

      totalFiles += encrypted + unencrypted;
      encryptedFiles += encrypted;
      unencryptedFiles += unencrypted;

      if (unencrypted > 0 && ['production', 'staging'].includes(env)) {
        recommendations.push(`Encrypt ${env} environment files for security`);
      }
    }

    console.log(`Total environments: ${chalk.cyan(environments.length)}`);
    console.log(`Total files: ${chalk.cyan(totalFiles)}`);
    console.log(`Encrypted: ${chalk.green(encryptedFiles)}`);
    console.log(
      `Unencrypted: ${unencryptedFiles > 0 ? chalk.yellow(unencryptedFiles) : chalk.gray(unencryptedFiles)}`
    );
  }

  // Secrets status
  console.log();
  const envrcExists = await FileUtils.fileExists(path.join(cwd, '.envrc'));
  console.log(
    `Secrets file (.envrc): ${envrcExists ? chalk.green('✓ Present') : chalk.yellow('✗ Missing')}`
  );

  if (!envrcExists) {
    recommendations.push('Set up .envrc file with "envx interactive"');
  }

  // Registered files
  if (registered.length > 0) {
    let encryptedRegistered = 0;
    for (const entry of registered) {
      const status = await getRegisteredFileStatus(filesRoot, entry);
      if (status.enc) {
        encryptedRegistered++;
      }
      if (status.plain && !status.enc) {
        recommendations.push(`Encrypt registered file ${entry.path}`);
      }
      if (!status.plain && !status.enc) {
        recommendations.push(
          `Registered file missing on disk: ${entry.path} (restore it or run "envx files remove")`
        );
      }
    }
    console.log(
      `Registered files: ${chalk.cyan(registered.length)} (${chalk.green(encryptedRegistered)} encrypted)`
    );
  }

  // Security recommendations
  if (recommendations.length > 0) {
    console.log();
    CliUtils.subheader('Recommendations');
    recommendations.forEach(rec => {
      console.log(chalk.yellow(`• ${rec}`));
    });
  } else {
    console.log();
    CliUtils.success('Your project follows security best practices! 🎉');
  }
}

async function executeInit(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  InteractiveUtils.displayWelcome();

  CliUtils.info('Initializing EnvX in your project...');
  console.log(`Directory: ${CliUtils.formatPath(cwd, process.cwd())}`);
  console.log();

  // Check prerequisites
  if (!ExecUtils.isGpgAvailable()) {
    CliUtils.error('GPG is required but not found.');
    InteractiveUtils.displayPrerequisites();
    return;
  }

  CliUtils.success('GPG is available');

  // Discover environments with default ignore filtering
  const filteredEnvironments = await FileUtils.findAllEnvironments(cwd);
  // Discover ALL environments (no filter) to detect what's being ignored
  const allEnvironments = await FileUtils.findAllEnvironments(cwd, []);
  const ignoredEnvironments = allEnvironments.filter(
    env => !filteredEnvironments.includes(env)
  );

  const envrcExists = await FileUtils.fileExists(path.join(cwd, '.envrc'));

  if (filteredEnvironments.length > 0 || envrcExists) {
    CliUtils.warning('EnvX appears to already be set up in this project.');

    if (filteredEnvironments.length > 0) {
      console.log(
        `Found environments: ${filteredEnvironments.map(env => CliUtils.formatEnvironment(env)).join(', ')}`
      );
    }

    if (envrcExists) {
      console.log('Found .envrc file');
    }

    const proceed = await InteractiveUtils.confirmOperation(
      'Do you want to continue with initialization anyway?',
      false
    );

    if (!proceed) {
      CliUtils.info('Initialization cancelled.');
      return;
    }
  }

  // Inform about auto-ignored environments
  if (ignoredEnvironments.length > 0) {
    CliUtils.info(
      `Auto-ignoring non-secret environments: ${ignoredEnvironments.map(env => chalk.gray(env)).join(', ')}`
    );
  }

  // Let user select which discovered envs to manage
  let selectedEnvironments: string[] = [];
  if (filteredEnvironments.length > 0) {
    selectedEnvironments = await InteractiveUtils.selectMultipleEnvironments(
      filteredEnvironments,
      'Select environments to manage:',
      filteredEnvironments // pre-check all discovered envs
    );

    // Offer to ignore non-selected environments
    const notSelected = filteredEnvironments.filter(
      env => !selectedEnvironments.includes(env)
    );
    if (notSelected.length > 0) {
      const ignoreThese = await InteractiveUtils.confirmOperation(
        `Ignore ${notSelected.map(e => chalk.magenta(e)).join(', ')} in future operations?`,
        true
      );

      if (ignoreThese) {
        const currentIgnore = await FileUtils.getIgnorePatterns(cwd);
        const newIgnore = Array.from(
          new Set([...currentIgnore, ...notSelected])
        );
        await FileUtils.mergeEnvxrc(cwd, { ignore: newIgnore });
        CliUtils.success(`Added ${notSelected.join(', ')} to ignore list`);
      }
    }
  }

  // Save selected environments to .envxrc
  if (selectedEnvironments.length > 0) {
    await FileUtils.mergeEnvxrc(cwd, {
      environments: selectedEnvironments,
    });
  }

  // Update .gitignore with smart EnvX patterns
  CliUtils.info('Setting up .gitignore...');
  const gitignoreResult = await FileUtils.updateGitignore(cwd);

  if (gitignoreResult.success) {
    CliUtils.success(gitignoreResult.message);
  } else {
    CliUtils.warning(`Could not update .gitignore: ${gitignoreResult.message}`);
  }

  // Show quick start guide
  await showQuickStart(cwd);

  // Offer to start interactive secret setup
  const startSetup = await InteractiveUtils.confirmOperation(
    'Would you like to set up encryption secrets now?'
  );

  if (startSetup) {
    console.log();
    CliUtils.info('Starting interactive setup...');

    const { executeInteractive } = await import('./commands/interactive');
    await executeInteractive({ cwd: options.cwd });

    // After secrets configured, offer to encrypt
    if (selectedEnvironments.length > 0) {
      const doEncrypt = await InteractiveUtils.confirmOperation(
        'Encrypt your environment files now?',
        true
      );

      if (doEncrypt) {
        console.log();
        CliUtils.info('Encrypting environment files...');

        for (const env of selectedEnvironments) {
          try {
            const result = await encryptEnvironment(env, cwd);
            if (result.successCount > 0) {
              CliUtils.success(
                `Encrypted ${result.successCount} file(s) for ${chalk.magenta(env)}`
              );
            }
            if (result.errorCount > 0) {
              CliUtils.warning(
                `Failed to encrypt ${result.errorCount} file(s) for ${chalk.magenta(env)}`
              );
            }
          } catch (error) {
            CliUtils.warning(
              `Could not encrypt ${env}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
    }
  } else {
    console.log();
    CliUtils.info('You can run the setup later with:');
    console.log(chalk.cyan('  envx interactive'));
  }

  // Final summary
  console.log();
  CliUtils.success('EnvX initialization complete!');
}

// Error handling
process.on('uncaughtException', error => {
  CliUtils.error(`Uncaught error: ${error.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(ExitCode.GENERAL_ERROR);
});

process.on('unhandledRejection', (reason, promise) => {
  CliUtils.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(ExitCode.GENERAL_ERROR);
});

// Main execution
async function main() {
  try {
    const program = await createProgram();

    // Show help if no command provided
    if (process.argv.length <= 2) {
      program.help();
      return;
    }

    await program.parseAsync(process.argv);
  } catch (error) {
    CliUtils.error(
      `Command failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(ExitCode.GENERAL_ERROR);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

export { createProgram };

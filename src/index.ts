#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import path from 'path';
import { createCreateCommand } from './commands/create';
import { createDecryptCommand } from './commands/decrypt';
import { createEncryptCommand } from './commands/encrypt';
import { createInteractiveCommand, showQuickStart } from './commands/interactive';
import { CliUtils, ExecUtils } from './utils/exec';
import { FileUtils } from './utils/file';
import { InteractiveUtils } from './utils/interactive';

// Package information
const packageJson = require('../package.json');

async function createProgram(): Promise<Command> {
  const program = new Command();

  program
    .name('envx')
    .description('Environment file encryption and management tool')
    .version(packageJson.version)
    .option('-v, --verbose', 'Enable verbose output')
    .option('-q, --quiet', 'Suppress non-error output')
    .hook('preAction', async (thisCommand) => {
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
  program.addCommand(createInteractiveCommand());

  // List command to show environment status
  program
    .command('list')
    .alias('ls')
    .description('List all environment files and their status')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async (options) => {
      try {
        await executeList(options);
      } catch (error) {
        CliUtils.error(`List failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // Status command to show overall project status
  program
    .command('status')
    .description('Show project encryption status and recommendations')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async (options) => {
      try {
        await executeStatus(options);
      } catch (error) {
        CliUtils.error(`Status check failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  // Init command for quick project setup
  program
    .command('init')
    .description('Initialize EnvX in a new project')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async (options) => {
      try {
        await executeInit(options);
      } catch (error) {
        CliUtils.error(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
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
      console.log(`Description: ${packageJson.description || 'Environment file encryption and management tool'}`);
      console.log();
      console.log('Dependencies:');
      console.log(`• GPG: ${ExecUtils.isGpgAvailable() ? chalk.green('Available') : chalk.red('Not found')}`);
      console.log(`• Node.js: ${chalk.green(process.version)}`);
      console.log();
    });

  return program;
}

async function executeList(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  CliUtils.header('Environment Files');

  const environments = await FileUtils.findAllEnvironments(cwd);

  if (environments.length === 0) {
    CliUtils.warning('No environment files found in the current directory.');
    console.log();
    CliUtils.info('To get started:');
    console.log(chalk.cyan('  envx init'));
    console.log(chalk.cyan('  envx create -i'));
    return;
  }

  const tableRows: string[][] = [];

  for (const env of environments.sort()) {
    const envFiles = await FileUtils.findEnvFiles(env, cwd);

    for (const file of envFiles) {
      const displayPath = file.encrypted
        ? FileUtils.getEncryptedPath(file.path)
        : file.path;

      const relativePath = FileUtils.getRelativePath(displayPath, cwd);
      const status = file.encrypted ? chalk.green('Encrypted') : chalk.yellow('Unencrypted');
      const type = file.encrypted ? '.gpg' : '.env';

      tableRows.push([
        CliUtils.formatEnvironment(env),
        chalk.cyan(relativePath),
        type,
        status
      ]);
    }
  }

  if (tableRows.length > 0) {
    CliUtils.printTable(['Environment', 'File Path', 'Type', 'Status'], tableRows);
  }

  // Show .envrc status
  console.log();
  const envrcExists = await FileUtils.fileExists(path.join(cwd, '.envrc'));
  CliUtils.info(`Secrets file (.envrc): ${envrcExists ? chalk.green('Present') : chalk.yellow('Not found')}`);

  if (!envrcExists) {
    console.log(chalk.gray('  Use "envx interactive" to set up secrets'));
  }
}

async function executeStatus(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  CliUtils.header('Project Status');

  // Check prerequisites
  CliUtils.subheader('Prerequisites');
  console.log(`GPG: ${ExecUtils.isGpgAvailable() ? chalk.green('✓ Available') : chalk.red('✗ Not found')}`);

  if (!ExecUtils.isGpgAvailable()) {
    InteractiveUtils.displayPrerequisites();
    return;
  }

  // Environment files status
  const environments = await FileUtils.findAllEnvironments(cwd);

  if (environments.length === 0) {
    CliUtils.warning('No environment files found.');
    console.log();
    CliUtils.info('Recommendations:');
    console.log(chalk.yellow('• Run "envx init" to get started'));
    console.log(chalk.yellow('• Create environment files with "envx create"'));
    return;
  }

  CliUtils.subheader('Environment Summary');

  let totalFiles = 0;
  let encryptedFiles = 0;
  let unencryptedFiles = 0;
  const recommendations: string[] = [];

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
  console.log(`Unencrypted: ${unencryptedFiles > 0 ? chalk.yellow(unencryptedFiles) : chalk.gray(unencryptedFiles)}`);

  // Secrets status
  console.log();
  const envrcExists = await FileUtils.fileExists(path.join(cwd, '.envrc'));
  console.log(`Secrets file (.envrc): ${envrcExists ? chalk.green('✓ Present') : chalk.yellow('✗ Missing')}`);

  if (!envrcExists) {
    recommendations.push('Set up .envrc file with "envx interactive"');
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

  // Check if already initialized
  const existingEnvironments = await FileUtils.findAllEnvironments(cwd);
  const envrcExists = await FileUtils.fileExists(path.join(cwd, '.envrc'));

  if (existingEnvironments.length > 0 || envrcExists) {
    CliUtils.warning('EnvX appears to already be set up in this project.');

    if (existingEnvironments.length > 0) {
      console.log(`Found environments: ${existingEnvironments.map(env => CliUtils.formatEnvironment(env)).join(', ')}`);
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

  // Check prerequisites
  if (!ExecUtils.isGpgAvailable()) {
    CliUtils.error('GPG is required but not found.');
    InteractiveUtils.displayPrerequisites();
    return;
  }

  CliUtils.success('GPG is available');

  // Show quick start guide
  await showQuickStart(cwd);

  // Offer to start setup
  const startSetup = await InteractiveUtils.confirmOperation(
    'Would you like to start the interactive setup now?'
  );

  if (startSetup) {
    console.log();
    CliUtils.info('Starting interactive setup...');

    // Delegate to interactive command
    const { createInteractiveCommand } = await import('./commands/interactive');
    const interactiveCmd = createInteractiveCommand();
    await interactiveCmd.parseAsync(['interactive'], { from: 'user' });
  } else {
    console.log();
    CliUtils.info('You can run the setup later with:');
    console.log(chalk.cyan('  envx interactive'));
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  CliUtils.error(`Uncaught error: ${error.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  CliUtils.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
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
    CliUtils.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

export { createProgram };

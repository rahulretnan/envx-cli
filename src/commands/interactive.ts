import chalk from 'chalk';
import { Command } from 'commander';
import path from 'path';
import { validateInteractiveOptions } from '../schemas';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';
import { InteractiveUtils } from '../utils/interactive';

export const createInteractiveCommand = (): Command => {
  const command = new Command('interactive');

  command
    .description('Interactive mode for setting up .envrc file with secrets')
    .option('-c, --cwd <path>', 'Working directory path')
    .option(
      '--overwrite',
      'Overwrite existing .envrc file without confirmation'
    )
    .option('--generate', 'Generate random secrets for all environments')
    .action(async options => {
      try {
        await executeInteractive(options);
      } catch (error) {
        CliUtils.error(
          `Interactive setup failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return command;
};

async function executeInteractive(rawOptions: any): Promise<void> {
  InteractiveUtils.displayWelcome();

  // Get working directory
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();

  // Validate options
  validateInteractiveOptions({
    cwd,
    overwrite: rawOptions.overwrite,
  });

  // Find existing environments
  const existingEnvironments = await FileUtils.findAllEnvironments(cwd);

  // Check if .envrc already exists
  const envrcPath = path.join(cwd, '.envrc');
  const envrcExists = await FileUtils.fileExists(envrcPath);

  if (envrcExists) {
    CliUtils.info(
      `Found existing .envrc file: ${CliUtils.formatPath(envrcPath, cwd)}`
    );

    if (!rawOptions.overwrite) {
      const showCurrent = await InteractiveUtils.confirmOperation(
        'Do you want to see the current .envrc contents?',
        true
      );

      if (showCurrent) {
        try {
          const currentConfig = await FileUtils.readEnvrc(cwd);
          const secrets = Object.keys(currentConfig).filter(key =>
            key.endsWith('_SECRET')
          );

          if (secrets.length > 0) {
            console.log();
            CliUtils.subheader('Current Secrets in .envrc');
            secrets.forEach(secret => {
              const stage = secret.replace('_SECRET', '').toLowerCase();
              console.log(
                `  • ${CliUtils.formatEnvironment(stage)}: ${chalk.cyan(secret)}`
              );
            });
          } else {
            CliUtils.warning('No secrets found in current .envrc file');
          }
        } catch (error) {
          CliUtils.error(`Could not read existing .envrc: ${error}`);
        }
      }

      const overwrite = await InteractiveUtils.confirmOperation(
        'Do you want to overwrite the existing .envrc file?',
        false
      );

      if (!overwrite) {
        CliUtils.info(
          'Keeping existing .envrc file. Use --overwrite flag to force overwrite.'
        );
        await showEnvrcUsageHelp(cwd);
        return;
      }
    }
  }

  try {
    // Run interactive setup
    const envrcConfig = await InteractiveUtils.setupEnvrc(
      cwd,
      existingEnvironments
    );

    // Write the .envrc file
    const writeResult = await FileUtils.writeEnvrc(cwd, envrcConfig);

    if (writeResult.success) {
      CliUtils.success(`Successfully created .envrc file`);
      console.log(
        `Location: ${CliUtils.formatPath(writeResult.filePath!, cwd)}`
      );

      // Show usage information
      await showEnvrcUsageHelp(cwd);

      // Show next steps for direnv
      await showDirenvSetup();
    } else {
      CliUtils.error(`Failed to create .envrc file: ${writeResult.message}`);
      if (writeResult.error) {
        console.log(chalk.red(`  • ${writeResult.error.message}`));
      }
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Setup cancelled by user') {
      CliUtils.info('Setup cancelled.');
      return;
    }
    throw error;
  }
}

async function showEnvrcUsageHelp(cwd: string): Promise<void> {
  console.log();
  CliUtils.subheader('How to Use .envrc');

  const envrcConfig = await FileUtils.readEnvrc(cwd);
  const secrets = Object.keys(envrcConfig).filter(key =>
    key.endsWith('_SECRET')
  );

  console.log('Your .envrc file contains secrets for encryption/decryption.');
  console.log('You can now use envx commands without specifying passphrases:');
  console.log();

  secrets.forEach(secret => {
    const stage = secret.replace('_SECRET', '').toLowerCase();
    console.log(chalk.cyan(`  envx encrypt -e ${stage}`));
    console.log(chalk.cyan(`  envx decrypt -e ${stage}`));
  });

  console.log();
  console.log('Or specify a custom secret:');
  console.log(chalk.cyan('  envx encrypt -e production -s PRODUCTION_SECRET'));
  console.log();
}

async function showDirenvSetup(): Promise<void> {
  CliUtils.subheader('Direnv Integration (Optional)');

  console.log('For automatic environment loading, you can use direnv:');
  console.log();

  // Check if direnv is installed
  try {
    ExecUtils.exec('direnv --version', { silent: true });
    CliUtils.success('Direnv is already installed!');
    console.log();
    console.log('To enable automatic loading:');
    console.log(chalk.cyan('  direnv allow'));
    console.log();
    console.log(
      'This will automatically export the secrets when you enter this directory.'
    );
  } catch {
    CliUtils.info('Direnv is not installed. To install:');
    console.log();
    console.log(chalk.yellow('macOS:'));
    console.log(chalk.cyan('  brew install direnv'));
    console.log();
    console.log(chalk.yellow('Ubuntu/Debian:'));
    console.log(chalk.cyan('  sudo apt install direnv'));
    console.log();
    console.log(chalk.yellow('Other systems:'));
    console.log(chalk.cyan('  https://direnv.net/docs/installation.html'));
    console.log();
    console.log('After installation, add to your shell profile:');
    console.log(chalk.cyan('  eval "$(direnv hook bash)"    # for bash'));
    console.log(chalk.cyan('  eval "$(direnv hook zsh)"     # for zsh'));
    console.log();
    console.log('Then run:');
    console.log(chalk.cyan('  direnv allow'));
  }

  console.log();
  CliUtils.warning('Security Note:');
  console.log(chalk.yellow('• Never commit .envrc to version control'));
  console.log(chalk.yellow('• Add .envrc to your .gitignore file'));
  console.log(chalk.yellow('• The secrets in .envrc are sensitive data'));
}

async function showEnvironmentSummary(cwd: string): Promise<void> {
  const environments = await FileUtils.findAllEnvironments(cwd);

  if (environments.length === 0) {
    return;
  }

  CliUtils.subheader('Environment Files Summary');

  const tableRows: string[][] = [];

  for (const env of environments.sort()) {
    const envFiles = await FileUtils.findEnvFiles(env, cwd);
    const unencrypted = envFiles.filter(f => !f.encrypted && f.exists);
    const encrypted = envFiles.filter(f => f.encrypted && f.exists);

    let status = '';
    if (unencrypted.length > 0 && encrypted.length > 0) {
      status = chalk.yellow('Mixed');
    } else if (encrypted.length > 0) {
      status = chalk.green('Encrypted');
    } else if (unencrypted.length > 0) {
      status = chalk.red('Unencrypted');
    } else {
      status = chalk.gray('No files');
    }

    const totalFiles = unencrypted.length + encrypted.length;
    const fileCount = totalFiles > 0 ? `${totalFiles} file(s)` : 'No files';

    tableRows.push([CliUtils.formatEnvironment(env), fileCount, status]);
  }

  CliUtils.printTable(['Environment', 'Files', 'Status'], tableRows);

  console.log();
  CliUtils.info('Commands to manage your environment files:');
  console.log(
    chalk.gray('• envx create -e <env>     Create new environment file')
  );
  console.log(
    chalk.gray('• envx encrypt -e <env>    Encrypt environment files')
  );
  console.log(
    chalk.gray('• envx decrypt -e <env>    Decrypt environment files')
  );
}

// Export additional helper for other commands
export async function showQuickStart(cwd: string): Promise<void> {
  CliUtils.header('EnvX Quick Start');

  console.log("Welcome to EnvX! Here's how to get started:");
  console.log();

  console.log(chalk.bold('1. Create environment files:'));
  console.log(chalk.cyan('   envx create -i'));
  console.log();

  console.log(chalk.bold('2. Set up secrets for encryption:'));
  console.log(chalk.cyan('   envx interactive'));
  console.log();

  console.log(chalk.bold('3. Encrypt your environment files:'));
  console.log(chalk.cyan('   envx encrypt -e production'));
  console.log();

  console.log(chalk.bold('4. Commit encrypted files to git:'));
  console.log(chalk.cyan('   git add *.gpg'));
  console.log(chalk.cyan('   git commit -m "Add encrypted environment files"'));
  console.log();

  console.log(chalk.bold('5. Decrypt when needed:'));
  console.log(chalk.cyan('   envx decrypt -e production'));
  console.log();

  await showEnvironmentSummary(cwd);
}

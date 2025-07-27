import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { EnvrcConfig, StageSecret } from '../types';
import { CliUtils } from './exec';
import { FileUtils } from './file';

export class InteractiveUtils {
  /**
   * Prompt for environment selection
   */
  static async selectEnvironment(
    environments: string[],
    message: string = 'Select environment:'
  ): Promise<string> {
    if (environments.length === 0) {
      throw new Error('No environments found');
    }

    if (environments.length === 1) {
      return environments[0];
    }

    const { environment } = await inquirer.prompt([
      {
        type: 'list',
        name: 'environment',
        message,
        choices: environments,
      },
    ]);

    return environment;
  }

  /**
   * Prompt for multiple environment selection
   */
  static async selectMultipleEnvironments(
    environments: string[],
    message: string = 'Select environments:'
  ): Promise<string[]> {
    if (environments.length === 0) {
      throw new Error('No environments found');
    }

    const { selectedEnvironments } = await inquirer.prompt({
      type: 'checkbox',
      name: 'selectedEnvironments',
      message,
      choices: environments,
      validate: (input: any) => {
        if (input.length === 0) {
          return 'Please select at least one environment';
        }
        return true;
      },
    });

    return selectedEnvironments;
  }

  /**
   * Prompt for passphrase
   */
  static async promptPassphrase(
    message: string = 'Enter passphrase:'
  ): Promise<string> {
    const { passphrase } = await inquirer.prompt([
      {
        type: 'password',
        name: 'passphrase',
        message,
        mask: '*',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Passphrase cannot be empty';
          }
          if (input.length < 4) {
            return 'Passphrase must be at least 4 characters long';
          }
          return true;
        },
      },
    ]);

    return passphrase;
  }

  /**
   * Confirm passphrase
   */
  static async confirmPassphrase(originalPassphrase: string): Promise<boolean> {
    const { confirmPassphrase } = await inquirer.prompt([
      {
        type: 'password',
        name: 'confirmPassphrase',
        message: 'Confirm passphrase:',
        mask: '*',
        validate: (input: string) => {
          if (input !== originalPassphrase) {
            return 'Passphrases do not match';
          }
          return true;
        },
      },
    ]);

    return confirmPassphrase === originalPassphrase;
  }

  /**
   * Prompt for new passphrase with confirmation
   */
  static async promptNewPassphrase(): Promise<string> {
    const passphrase = await this.promptPassphrase('Enter new passphrase:');
    await this.confirmPassphrase(passphrase);
    return passphrase;
  }

  /**
   * Prompt for environment name
   */
  static async promptEnvironmentName(
    message: string = 'Enter environment name:'
  ): Promise<string> {
    const { environment } = await inquirer.prompt([
      {
        type: 'input',
        name: 'environment',
        message,
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Environment name cannot be empty';
          }
          if (!FileUtils.isValidEnvironmentName(input.trim())) {
            return 'Environment name can only contain letters, numbers, hyphens, and underscores';
          }
          return true;
        },
        filter: (input: string) => input.trim().toLowerCase(),
      },
    ]);

    return environment;
  }

  /**
   * Prompt for secret generation or manual entry
   */
  static async promptSecret(stageName: string): Promise<string> {
    const { secretOption } = await inquirer.prompt([
      {
        type: 'list',
        name: 'secretOption',
        message: `How would you like to set the secret for ${chalk.magenta(stageName)}?`,
        choices: [
          { name: 'Generate random secret', value: 'generate' },
          { name: 'Enter custom secret', value: 'custom' },
        ],
      },
    ]);

    if (secretOption === 'generate') {
      const { secretLength } = await inquirer.prompt([
        {
          type: 'list',
          name: 'secretLength',
          message: 'Select secret length:',
          choices: [
            { name: '32 characters (recommended)', value: 32 },
            { name: '64 characters (high security)', value: 64 },
            { name: '16 characters (basic)', value: 16 },
          ],
          default: 32,
        },
      ]);

      return FileUtils.generateRandomSecret(secretLength);
    } else {
      const { customSecret } = await inquirer.prompt([
        {
          type: 'password',
          name: 'customSecret',
          message: `Enter secret for ${stageName}:`,
          mask: '*',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'Secret cannot be empty';
            }
            if (input.length < 8) {
              return 'Secret must be at least 8 characters long';
            }
            return true;
          },
        },
      ]);

      return customSecret;
    }
  }

  /**
   * Interactive setup for .envrc file
   */
  static async setupEnvrc(
    cwd: string,
    existingEnvironments: string[] = []
  ): Promise<EnvrcConfig> {
    CliUtils.header('Interactive .envrc Setup');

    console.log(
      chalk.gray('This will help you set up secrets for your environments.')
    );
    console.log(chalk.gray('The secrets will be stored in a .envrc file.'));
    console.log();

    const envrcPath = path.join(cwd, '.envrc');
    const envrcExists = await FileUtils.fileExists(envrcPath);

    if (envrcExists) {
      CliUtils.warning('.envrc file already exists');

      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Do you want to overwrite the existing .envrc file?',
          default: false,
        },
      ]);

      if (!overwrite) {
        CliUtils.info('Keeping existing .envrc file');
        return await FileUtils.readEnvrc(cwd);
      }
    }

    let environments: string[] = [];

    if (existingEnvironments.length > 0) {
      CliUtils.info(
        `Found existing environments: ${existingEnvironments.map(env => chalk.magenta(env)).join(', ')}`
      );

      const { useExisting } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useExisting',
          message:
            'Do you want to set up secrets for these existing environments?',
          default: true,
        },
      ]);

      if (useExisting) {
        const selectedEnvs = await this.selectMultipleEnvironments(
          existingEnvironments,
          'Select environments to set up secrets for:'
        );
        environments = environments.concat(selectedEnvs);
      }
    }

    // Ask if they want to add more environments
    const { addMore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addMore',
        message: 'Do you want to add secrets for additional environments?',
        default: environments.length === 0,
      },
    ]);

    if (addMore) {
      let addingMore = true;
      while (addingMore) {
        const newEnv = await this.promptEnvironmentName(
          'Enter new environment name:'
        );

        if (!environments.includes(newEnv)) {
          environments.push(newEnv);
          CliUtils.success(`Added ${chalk.magenta(newEnv)} to the list`);
        } else {
          CliUtils.warning(
            `Environment ${chalk.magenta(newEnv)} already exists in the list`
          );
        }

        const { continueAdding } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueAdding',
            message: 'Do you want to add another environment?',
            default: false,
          },
        ]);

        addingMore = continueAdding;
      }
    }

    if (environments.length === 0) {
      throw new Error('No environments selected for .envrc setup');
    }

    // Generate secrets for each environment
    const config: EnvrcConfig = {};
    const secrets: StageSecret[] = [];

    CliUtils.subheader('Setting up secrets');

    for (const env of environments.sort()) {
      console.log();
      CliUtils.info(`Setting up secret for ${chalk.magenta(env)}`);

      const secret = await this.promptSecret(env);
      const variableName = FileUtils.generateSecretVariableName(env);

      config[variableName] = secret;
      secrets.push({
        stage: env,
        secret,
        variableName,
      });

      CliUtils.success(
        `Secret configured for ${chalk.magenta(env)} as ${chalk.cyan(variableName)}`
      );
    }

    // Show summary
    console.log();
    CliUtils.subheader('Summary');

    const tableRows = secrets.map(({ stage, variableName }) => [
      chalk.magenta(stage),
      chalk.cyan(variableName),
      chalk.green('✓ Set'),
    ]);

    CliUtils.printTable(['Environment', 'Variable Name', 'Status'], tableRows);

    // Confirm creation
    const { confirmCreate } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmCreate',
        message: 'Create .envrc file with these settings?',
        default: true,
      },
    ]);

    if (!confirmCreate) {
      throw new Error('Setup cancelled by user');
    }

    return config;
  }

  /**
   * Interactive file selection
   */
  static async selectFiles(
    files: string[],
    message: string = 'Select files:'
  ): Promise<string[]> {
    if (files.length === 0) {
      throw new Error('No files available for selection');
    }

    if (files.length === 1) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Process file ${chalk.cyan(files[0])}?`,
          default: true,
        },
      ]);

      return confirm ? files : [];
    }

    const { selectedFiles } = await inquirer.prompt({
      type: 'checkbox',
      name: 'selectedFiles',
      message,
      choices: files.map(file => ({
        name: file,
        value: file,
      })),
      validate: (input: any) => {
        if (input.length === 0) {
          return 'Please select at least one file';
        }
        return true;
      },
    });

    return selectedFiles;
  }

  /**
   * Confirm operation
   */
  static async confirmOperation(
    message: string,
    defaultValue: boolean = true
  ): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message,
        default: defaultValue,
      },
    ]);

    return confirm;
  }

  /**
   * Select operation mode
   */
  static async selectOperationMode(): Promise<
    'encrypt' | 'decrypt' | 'create' | 'interactive'
  > {
    const { operation } = await inquirer.prompt([
      {
        type: 'list',
        name: 'operation',
        message: 'What would you like to do?',
        choices: [
          { name: 'Encrypt environment files', value: 'encrypt' },
          { name: 'Decrypt environment files', value: 'decrypt' },
          { name: 'Create new environment file', value: 'create' },
          { name: 'Interactive setup (.envrc)', value: 'interactive' },
        ],
      },
    ]);

    return operation;
  }

  /**
   * Progress indicator
   */
  static async withProgress<T>(
    promise: Promise<T>,
    message: string = 'Processing...'
  ): Promise<T> {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    const interval = setInterval(() => {
      process.stdout.write(`\r${spinner[i]} ${message}`);
      i = (i + 1) % spinner.length;
    }, 100);

    try {
      const result = await promise;
      clearInterval(interval);
      process.stdout.write(`\r✓ ${message}\n`);
      return result;
    } catch (error) {
      clearInterval(interval);
      process.stdout.write(`\r✗ ${message}\n`);
      throw error;
    }
  }

  /**
   * Display welcome message
   */
  static displayWelcome(): void {
    console.log();
    console.log(chalk.bold.cyan('🔐 Welcome to EnvX'));
    console.log(chalk.gray('Environment file encryption and management tool'));
    console.log();
  }

  /**
   * Display help for prerequisites
   */
  static displayPrerequisites(): void {
    CliUtils.header('Prerequisites');
    console.log('Before using EnvX, make sure you have:');
    console.log(chalk.yellow('• GPG installed and configured'));
    console.log(
      chalk.yellow('• Appropriate file permissions in your project directory')
    );
    console.log();
    console.log('To install GPG:');
    console.log(chalk.cyan('• macOS: brew install gnupg'));
    console.log(chalk.cyan('• Ubuntu/Debian: sudo apt-get install gnupg'));
    console.log(
      chalk.cyan('• Windows: Download from https://gnupg.org/download/')
    );
    console.log();
  }
}

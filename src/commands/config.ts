import chalk from 'chalk';
import { Command } from 'commander';
import { ExitCode } from '../types';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';

export const createConfigCommand = (): Command => {
  const config = new Command('config');

  config.description('Manage .envxrc configuration');

  config
    .command('show')
    .description('Display current .envxrc configuration')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeConfigShow(options);
      } catch (error) {
        CliUtils.error(
          `Config show failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  const ignore = config.command('ignore').description('Manage ignore patterns');

  ignore
    .command('list')
    .description('List current ignore patterns')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeIgnoreList(options);
      } catch (error) {
        CliUtils.error(
          `Config ignore list failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  ignore
    .command('add <pattern>')
    .description('Add a pattern to the ignore list')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async (pattern, options) => {
      try {
        await executeIgnoreAdd(pattern, options);
      } catch (error) {
        CliUtils.error(
          `Config ignore add failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  ignore
    .command('remove <pattern>')
    .description('Remove a pattern from the ignore list')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async (pattern, options) => {
      try {
        await executeIgnoreRemove(pattern, options);
      } catch (error) {
        CliUtils.error(
          `Config ignore remove failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  const exclude = config
    .command('exclude')
    .description('Manage excluded directories');

  exclude
    .command('list')
    .description('List excluded directories')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeExcludeList(options);
      } catch (error) {
        CliUtils.error(
          `Config exclude list failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  exclude
    .command('add <dir>')
    .description('Add a directory to the exclusion list')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async (dir, options) => {
      try {
        await executeExcludeAdd(dir, options);
      } catch (error) {
        CliUtils.error(
          `Config exclude add failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  exclude
    .command('remove <dir>')
    .description('Remove a directory from the exclusion list')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async (dir, options) => {
      try {
        await executeExcludeRemove(dir, options);
      } catch (error) {
        CliUtils.error(
          `Config exclude remove failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  config
    .command('reset')
    .description('Reset .envxrc to default configuration')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(async options => {
      try {
        await executeConfigReset(options);
      } catch (error) {
        CliUtils.error(
          `Config reset failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(ExitCode.GENERAL_ERROR);
      }
    });

  return config;
};

async function executeConfigShow(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  CliUtils.header('EnvX Configuration');

  const config = await FileUtils.readEnvxrc(cwd);

  if (Object.keys(config).length === 0) {
    CliUtils.info('No .envxrc found — using default configuration.');
    console.log();
    console.log(
      `Default ignore patterns: ${FileUtils.DEFAULT_IGNORE_PATTERNS.map(p => chalk.gray(p)).join(', ')}`
    );
    console.log(
      `Default excluded dirs: ${FileUtils.DEFAULT_EXCLUDE_DIRS.map(d => chalk.gray(d)).join(', ')}`
    );
    return;
  }

  if (config.ignore && config.ignore.length > 0) {
    console.log(
      `Ignore patterns: ${config.ignore.map(p => chalk.magenta(p)).join(', ')}`
    );
  } else {
    console.log('Ignore patterns: (none)');
  }

  if (config.excludeDirs && config.excludeDirs.length > 0) {
    console.log(
      `Excluded dirs: ${config.excludeDirs.map(d => chalk.yellow(d)).join(', ')}`
    );
  } else {
    console.log(
      `Excluded dirs: (defaults) ${FileUtils.DEFAULT_EXCLUDE_DIRS.map(d => chalk.gray(d)).join(', ')}`
    );
  }

  if (config.environments && config.environments.length > 0) {
    console.log(
      `Managed environments: ${config.environments.map(e => chalk.cyan(e)).join(', ')}`
    );
  }
}

async function executeIgnoreList(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const patterns = await FileUtils.getIgnorePatterns(cwd);

  CliUtils.header('Ignore Patterns');

  if (patterns.length === 0) {
    CliUtils.info('No ignore patterns configured.');
    return;
  }

  const config = await FileUtils.readEnvxrc(cwd);
  const isDefault = !config.ignore;

  if (isDefault) {
    CliUtils.info('Using default patterns:');
  }

  for (const pattern of patterns) {
    console.log(`  • ${chalk.magenta(pattern)}`);
  }
}

async function executeIgnoreAdd(pattern: string, options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const current = await FileUtils.getIgnorePatterns(cwd);

  if (current.some(p => p.toLowerCase() === pattern.toLowerCase())) {
    CliUtils.warning(`Pattern '${pattern}' is already in the ignore list.`);
    return;
  }

  const newIgnore = [...current, pattern];
  const result = await FileUtils.mergeEnvxrc(cwd, {
    ignore: newIgnore,
  });

  if (result.success) {
    CliUtils.success(`Added '${pattern}' to ignore list.`);
  } else {
    CliUtils.error(`Failed to update config: ${result.message}`);
  }
}

async function executeIgnoreRemove(
  pattern: string,
  options: any
): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const current = await FileUtils.getIgnorePatterns(cwd);

  const index = current.findIndex(
    p => p.toLowerCase() === pattern.toLowerCase()
  );

  if (index === -1) {
    CliUtils.warning(`Pattern '${pattern}' is not in the ignore list.`);
    return;
  }

  const newIgnore = [...current];
  newIgnore.splice(index, 1);

  const result = await FileUtils.mergeEnvxrc(cwd, {
    ignore: newIgnore,
  });

  if (result.success) {
    CliUtils.success(`Removed '${pattern}' from ignore list.`);
  } else {
    CliUtils.error(`Failed to update config: ${result.message}`);
  }
}

async function executeExcludeList(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const dirs = await FileUtils.getExcludeDirs(cwd);

  CliUtils.header('Excluded Directories');

  if (dirs.length === 0) {
    CliUtils.info('No excluded directories configured.');
    return;
  }

  const config = await FileUtils.readEnvxrc(cwd);
  const isDefault = !config.excludeDirs;

  if (isDefault) {
    CliUtils.info('Using default directories:');
  }

  for (const dir of dirs) {
    console.log(`  • ${chalk.yellow(dir)}`);
  }
}

async function executeExcludeAdd(dir: string, options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const current = await FileUtils.getExcludeDirs(cwd);

  if (current.some(d => d.toLowerCase() === dir.toLowerCase())) {
    CliUtils.warning(`Directory '${dir}' is already in the exclusion list.`);
    return;
  }

  const newExcludeDirs = [...current, dir];
  const result = await FileUtils.mergeEnvxrc(cwd, {
    excludeDirs: newExcludeDirs,
  });

  if (result.success) {
    CliUtils.success(`Added '${dir}' to excluded directories.`);
  } else {
    CliUtils.error(`Failed to update config: ${result.message}`);
  }
}

async function executeExcludeRemove(dir: string, options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const current = await FileUtils.getExcludeDirs(cwd);

  const index = current.findIndex(d => d.toLowerCase() === dir.toLowerCase());

  if (index === -1) {
    CliUtils.warning(`Directory '${dir}' is not in the exclusion list.`);
    return;
  }

  const newExcludeDirs = [...current];
  newExcludeDirs.splice(index, 1);

  const result = await FileUtils.mergeEnvxrc(cwd, {
    excludeDirs: newExcludeDirs,
  });

  if (result.success) {
    CliUtils.success(`Removed '${dir}' from excluded directories.`);
  } else {
    CliUtils.error(`Failed to update config: ${result.message}`);
  }
}

async function executeConfigReset(options: any): Promise<void> {
  const cwd = options.cwd || ExecUtils.getCurrentDir();

  const result = await FileUtils.writeEnvxrc(cwd, {
    ignore: [...FileUtils.DEFAULT_IGNORE_PATTERNS],
    excludeDirs: [...FileUtils.DEFAULT_EXCLUDE_DIRS],
  });

  if (result.success) {
    CliUtils.success('Reset .envxrc to default configuration.');
  } else {
    CliUtils.error(`Failed to reset config: ${result.message}`);
  }
}

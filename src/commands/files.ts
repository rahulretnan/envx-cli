import chalk from 'chalk';
import { Command } from 'commander';
import path from 'path';
import { registeredFileSchema, validateSchema } from '../schemas';
import { ExitCode, RegisteredFile } from '../types';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';
import { InteractiveUtils } from '../utils/interactive';

/**
 * Error carrying a specific exit code, mirroring RunError in run.ts.
 */
class FilesError extends Error {
  constructor(
    message: string,
    public exitCode: ExitCode
  ) {
    super(message);
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RawFilesOptions = any;

const actionWrapper =
  (fn: (...args: string[]) => Promise<void>, label: string) =>
  async (...args: unknown[]) => {
    try {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      await (fn as any)(...args);
    } catch (error) {
      CliUtils.error(
        `${label} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      const exit =
        (error as { exitCode?: number }).exitCode ?? ExitCode.GENERAL_ERROR;
      process.exit(exit);
    }
  };

export const createFilesCommand = (): Command => {
  const files = new Command('files');

  files.description('Manage and encrypt registered secret files');

  files
    .command('add <path>')
    .description('Register a file for encryption (optionally stage-bound)')
    .option('-e, --environment <env>', 'Bind the file to a stage')
    .option('--no-gitignore', 'Skip updating .gitignore')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(actionWrapper(executeFilesAdd, 'Files add'));

  files
    .command('remove <path>')
    .description('Unregister a file (leaves .gitignore untouched)')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(actionWrapper(executeFilesRemove, 'Files remove'));

  files
    .command('list')
    .description('List registered files and their encryption status')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(actionWrapper(executeFilesList, 'Files list'));

  return files;
};

/**
 * Status of a registered file on disk. Shared by `files list`, `envx list`
 * and `envx status`.
 */
export async function getRegisteredFileStatus(
  root: string,
  entry: RegisteredFile
): Promise<{ plain: boolean; enc: boolean; label: string }> {
  const abs = path.join(root, entry.path);
  const plain = await FileUtils.fileExists(abs);
  const enc = await FileUtils.fileExists(FileUtils.getEncryptedPath(abs));

  let label: string;
  if (plain && enc) {
    label = chalk.green('Encrypted');
  } else if (!plain && enc) {
    label = chalk.green('Encrypted only');
  } else if (plain) {
    label = chalk.yellow('Unencrypted');
  } else {
    label = chalk.red('Missing');
  }

  return { plain, enc, label };
}

export async function executeFilesAdd(
  filePath: string,
  rawOptions: RawFilesOptions
): Promise<void> {
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();
  const { root, entries } = await FileUtils.getRegisteredFiles(cwd);

  const rel = FileUtils.rebaseToRoot(filePath, cwd, root);

  const entry: RegisteredFile = rawOptions.environment
    ? { path: rel, stage: String(rawOptions.environment) }
    : { path: rel };
  validateSchema(registeredFileSchema, entry);

  if (entries.some(e => e.path === rel)) {
    CliUtils.warning(`'${rel}' is already registered.`);
    return;
  }

  const abs = path.join(root, rel);
  if (!(await FileUtils.fileExists(abs))) {
    const proceed = await InteractiveUtils.confirmOperation(
      `File ${chalk.cyan(rel)} does not exist yet. Register anyway?`,
      false
    );
    if (!proceed) {
      CliUtils.info('Operation cancelled.');
      return;
    }
  }

  // Warn if the plaintext is already tracked by git — the secret may
  // already be in history.
  if (ExecUtils.isPathTrackedByGit(rel, root)) {
    CliUtils.warning(
      `${rel} is tracked by git — the plaintext may already be committed. ` +
        'Consider `git rm --cached` after encrypting.'
    );
  }

  const result = await FileUtils.mergeEnvxrc(cwd, {
    files: [...entries, entry],
  });
  if (!result.success) {
    throw new FilesError(
      `Failed to update config: ${result.message}`,
      ExitCode.FILE_ERROR
    );
  }

  CliUtils.success(
    `Registered '${rel}'${
      entry.stage
        ? ` for ${CliUtils.formatEnvironment(entry.stage)}`
        : ' (global)'
    }.`
  );

  // commander maps --no-gitignore to gitignore: false
  if (rawOptions.gitignore !== false) {
    const gitignoreResult = await FileUtils.addFilesToGitignore(root, [rel]);
    if (gitignoreResult.success) {
      CliUtils.success(gitignoreResult.message);
    } else {
      CliUtils.warning(
        `Could not update .gitignore: ${gitignoreResult.message}`
      );
    }
  }
}

export async function executeFilesRemove(
  filePath: string,
  rawOptions: RawFilesOptions
): Promise<void> {
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();
  const { root, entries } = await FileUtils.getRegisteredFiles(cwd);

  const rel = FileUtils.rebaseToRoot(filePath, cwd, root);

  const index = entries.findIndex(e => e.path === rel);
  if (index === -1) {
    CliUtils.warning(`'${rel}' is not registered.`);
    return;
  }

  const next = [...entries];
  next.splice(index, 1);

  const result = await FileUtils.mergeEnvxrc(cwd, { files: next });
  if (!result.success) {
    throw new FilesError(
      `Failed to update config: ${result.message}`,
      ExitCode.FILE_ERROR
    );
  }

  CliUtils.success(`Removed '${rel}' from the registry.`);
  CliUtils.info('.gitignore entries were left in place.');
}

export async function executeFilesList(
  rawOptions: RawFilesOptions
): Promise<void> {
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();
  const { root, entries } = await FileUtils.getRegisteredFiles(cwd);

  CliUtils.header('Registered Files');

  if (entries.length === 0) {
    CliUtils.info(
      'No files registered. Use "envx files add <path>" to register one.'
    );
    return;
  }

  const rows: string[][] = [];
  for (const entry of entries) {
    const status = await getRegisteredFileStatus(root, entry);
    rows.push([
      chalk.cyan(entry.path),
      entry.stage
        ? CliUtils.formatEnvironment(entry.stage)
        : chalk.gray('global'),
      status.plain ? 'yes' : '—',
      status.enc ? 'yes' : '—',
      status.label,
    ]);
  }

  CliUtils.printTable(
    ['Path', 'Stage', 'Plaintext', 'Encrypted', 'Status'],
    rows
  );
}

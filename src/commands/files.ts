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

  files
    .command('encrypt [path]')
    .description('Encrypt registered files (all, or one by path)')
    .option('-p, --passphrase <passphrase>', 'Passphrase for encryption')
    .option('-s, --secret <secret>', 'Secret key from .envrc')
    .option('--dry-run', 'Show what would happen without making changes')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(actionWrapper(executeFilesEncrypt, 'Files encrypt'));

  files
    .command('decrypt [path]')
    .description('Decrypt registered files (all, or one by path)')
    .option('-p, --passphrase <passphrase>', 'Passphrase for decryption')
    .option('-s, --secret <secret>', 'Secret key from .envrc')
    .option('--overwrite', 'Overwrite existing files without confirmation')
    .option('--dry-run', 'Show what would happen without making changes')
    .option('-c, --cwd <path>', 'Working directory path')
    .action(actionWrapper(executeFilesDecrypt, 'Files decrypt'));

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

export interface FilesProcessOptions {
  mode: 'encrypt' | 'decrypt';
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  rawOptions: any;
  /** Ride-along: an already-resolved stage passphrase (skips resolution). */
  passphraseOverride?: string;
  isPartOfAll?: boolean;
}

/**
 * Encrypt or decrypt registered files. Groups entries by their secret
 * variable (stage secret or FILES_SECRET), resolves one passphrase per
 * group, GPG-tests each distinct passphrase once, then processes files
 * with the same idempotency (encrypt) and backup/restore (decrypt)
 * behavior the env commands use.
 */
export async function processRegisteredFiles(
  entries: RegisteredFile[],
  root: string,
  opts: FilesProcessOptions
): Promise<{ successCount: number; errorCount: number }> {
  const { mode, rawOptions, passphraseOverride, isPartOfAll } = opts;
  let successCount = 0;
  let errorCount = 0;

  if (entries.length === 0) {
    return { successCount, errorCount };
  }

  // Group by secret variable
  const groups = new Map<string, RegisteredFile[]>();
  for (const entry of entries) {
    const key = entry.stage
      ? FileUtils.generateSecretVariableName(entry.stage)
      : FileUtils.FILES_SECRET_NAME;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }

  const envrcConfig = await FileUtils.readEnvrcNearest(root);
  const testedPassphrases = new Set<string>();

  for (const [secretVar, groupEntries] of groups) {
    // Resolve passphrase: override > -p > -s > <secretVar> > prompt
    let passphrase: string = passphraseOverride || rawOptions.passphrase || '';
    if (!passphrase || passphrase.trim() === '') {
      if (rawOptions.secret && envrcConfig[rawOptions.secret]) {
        passphrase = envrcConfig[rawOptions.secret];
        CliUtils.info(
          `Using secret from .envrc: ${chalk.cyan(rawOptions.secret)}`
        );
      } else if (envrcConfig[secretVar]) {
        passphrase = envrcConfig[secretVar];
        CliUtils.info(`Using secret from .envrc: ${chalk.cyan(secretVar)}`);
      } else if (!rawOptions.dryRun) {
        passphrase = await InteractiveUtils.promptPassphrase(
          `Enter ${mode === 'encrypt' ? 'encryption' : 'decryption'} passphrase (${secretVar}):`
        );
      }
    }

    // Dry-run: report and count, never touch gpg
    if (rawOptions.dryRun) {
      for (const entry of groupEntries) {
        console.log(
          `  would ${mode}: ${chalk.cyan(entry.path)} (${secretVar})`
        );
        successCount++;
      }
      continue;
    }

    if (!testedPassphrases.has(passphrase)) {
      const gpgTest = ExecUtils.testGpgOperation(passphrase);
      if (!gpgTest.success) {
        CliUtils.error(`GPG test failed for ${secretVar}: ${gpgTest.message}`);
        errorCount += groupEntries.length;
        continue;
      }
      testedPassphrases.add(passphrase);
    }

    for (const entry of groupEntries) {
      try {
        const outcome =
          mode === 'encrypt'
            ? await encryptRegisteredFile(root, entry, passphrase)
            : await decryptRegisteredFile(
                root,
                entry,
                passphrase,
                rawOptions,
                isPartOfAll
              );
        if (outcome === 'success') {
          successCount++;
        } else if (outcome === 'error') {
          errorCount++;
        }
        // 'skip' counts as neither
      } catch (error) {
        CliUtils.error(
          `Error processing ${entry.path}: ${error instanceof Error ? error.message : String(error)}`
        );
        errorCount++;
      }
    }
  }

  return { successCount, errorCount };
}

type FileOutcome = 'success' | 'error' | 'skip';

async function encryptRegisteredFile(
  root: string,
  entry: RegisteredFile,
  passphrase: string
): Promise<FileOutcome> {
  const abs = path.join(root, entry.path);
  const encryptedPath = FileUtils.getEncryptedPath(abs);

  if (!(await FileUtils.fileExists(abs))) {
    if (await FileUtils.fileExists(encryptedPath)) {
      CliUtils.info(`${entry.path}: only the encrypted copy exists — skipping`);
    } else {
      CliUtils.warning(`${entry.path}: file not found — skipping`);
    }
    return 'skip';
  }

  // Idempotency: skip when the existing .gpg decrypts to identical content
  if (await FileUtils.fileExists(encryptedPath)) {
    const tempPath = `${abs}.temp.${Date.now()}`;
    try {
      const decryptResult = ExecUtils.decryptFile(
        encryptedPath,
        tempPath,
        passphrase
      );
      if (decryptResult.success) {
        const identical = await FileUtils.filesAreIdentical(abs, tempPath);
        if (await FileUtils.fileExists(tempPath)) {
          ExecUtils.removeFile(tempPath);
        }
        if (identical) {
          CliUtils.success(
            `${entry.path}: already encrypted with same content — skipping`
          );
          return 'success';
        }
        CliUtils.warning(
          `${entry.path}: has changes — updating encrypted version`
        );
      }
    } catch {
      if (await FileUtils.fileExists(tempPath)) {
        ExecUtils.removeFile(tempPath);
      }
    }
  }

  const result = ExecUtils.encryptFile(abs, passphrase);
  if (result.success) {
    CliUtils.success(`Encrypted: ${chalk.cyan(entry.path)}`);
    return 'success';
  }
  CliUtils.error(`Failed to encrypt ${entry.path}: ${result.message}`);
  return 'error';
}

async function decryptRegisteredFile(
  root: string,
  entry: RegisteredFile,
  passphrase: string,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  rawOptions: any,
  isPartOfAll?: boolean
): Promise<FileOutcome> {
  const abs = path.join(root, entry.path);
  const encryptedPath = FileUtils.getEncryptedPath(abs);

  if (!(await FileUtils.fileExists(encryptedPath))) {
    CliUtils.warning(`${entry.path}: no encrypted copy found — skipping`);
    return 'skip';
  }

  const plainExists = await FileUtils.fileExists(abs);
  if (plainExists && !rawOptions.overwrite && !isPartOfAll) {
    const confirm = await InteractiveUtils.confirmOperation(
      `Overwrite existing ${chalk.cyan(entry.path)}?`,
      false
    );
    if (!confirm) {
      CliUtils.info(`Skipped ${entry.path}.`);
      return 'skip';
    }
  }

  let backupPath: string | null = null;
  if (plainExists) {
    backupPath = await FileUtils.createBackup(abs);
  }

  const result = ExecUtils.decryptFile(encryptedPath, abs, passphrase);
  if (result.success) {
    if (backupPath) {
      await FileUtils.removeBackup(backupPath);
    }
    CliUtils.success(`Decrypted: ${chalk.cyan(entry.path)}`);
    return 'success';
  }

  if (backupPath) {
    ExecUtils.moveFile(backupPath, abs);
    CliUtils.info(`Restored original ${entry.path} from backup`);
  }
  CliUtils.error(`Failed to decrypt ${entry.path}: ${result.message}`);
  return 'error';
}

export async function executeFilesEncrypt(
  filePath: string | undefined,
  rawOptions: RawFilesOptions
): Promise<void> {
  await runFilesCrypto('encrypt', filePath, rawOptions);
}

export async function executeFilesDecrypt(
  filePath: string | undefined,
  rawOptions: RawFilesOptions
): Promise<void> {
  await runFilesCrypto('decrypt', filePath, rawOptions);
}

async function runFilesCrypto(
  mode: 'encrypt' | 'decrypt',
  filePath: string | undefined,
  rawOptions: RawFilesOptions
): Promise<void> {
  const cwd = rawOptions.cwd || ExecUtils.getCurrentDir();

  CliUtils.header(
    mode === 'encrypt'
      ? 'Registered File Encryption'
      : 'Registered File Decryption'
  );

  // Dry-run needs no gpg — skip the guard so previews work anywhere
  if (!rawOptions.dryRun && !ExecUtils.isGpgAvailable()) {
    CliUtils.error('GPG is not available. Please install GPG.');
    InteractiveUtils.displayPrerequisites();
    process.exit(ExitCode.GPG_ERROR);
  }

  const { root, entries } = await FileUtils.getRegisteredFiles(cwd);

  let selected = entries;
  if (filePath) {
    const rel = FileUtils.rebaseToRoot(filePath, cwd, root);
    selected = entries.filter(e => e.path === rel);
    if (selected.length === 0) {
      throw new FilesError(
        `'${rel}' is not registered. Use "envx files add" first.`,
        ExitCode.INVALID_ARGS
      );
    }
  }

  if (selected.length === 0) {
    CliUtils.warning(
      'No files registered. Use "envx files add <path>" to register one.'
    );
    return;
  }

  if (rawOptions.dryRun) {
    CliUtils.info('Dry run — no files will be modified.');
  }

  const result = await processRegisteredFiles(selected, root, {
    mode,
    rawOptions,
  });

  console.log();
  if (result.successCount > 0) {
    CliUtils.success(`Successfully ${mode}ed ${result.successCount} file(s)`);
  }
  if (result.errorCount > 0) {
    CliUtils.error(`Failed to ${mode} ${result.errorCount} file(s)`);
    process.exit(ExitCode.GENERAL_ERROR);
  }
}

import chalk from 'chalk';
import { getUpdateNote, maybeRefreshInBackground } from './update-check';

export const TIPS: string[] = [
  'encrypt --all encrypts every stage in one go',
  'decrypt --all after cloning restores every stage and registered file',
  'run -e prod -- <cmd> injects secrets with no plaintext on disk',
  'files add <path> encrypts certs and keystores alongside your envs',
  '--dry-run previews encrypt/decrypt without writing anything',
  'config show prints the resolved .envxrc for this project',
  'list and status show what is encrypted and what is missing',
  'copy -e <stage> writes a stage file to a plain .env',
  'create -e <stage> scaffolds a new environment file',
  'interactive sets up your .envrc passphrases',
  'skill add installs an agent skill so AI tools use envx correctly',
];

export function shouldShowHints(opts: { quiet?: boolean }): boolean {
  if (process.env.ENVX_NO_HINTS) {
    return false;
  }
  if (process.env.CI) {
    return false;
  }
  if (!process.stdout.isTTY) {
    return false;
  }
  if (opts.quiet) {
    return false;
  }
  return true;
}

export function pickTip(): string {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

export function printAdvisories(
  opts: { quiet?: boolean },
  current: string
): void {
  try {
    if (!shouldShowHints(opts)) {
      return;
    }

    const note = getUpdateNote(current);
    if (note) {
      console.log(note);
    }

    console.log(chalk.dim(`💡 ${pickTip()}`));

    maybeRefreshInBackground();
  } catch {
    // advisories must never affect the CLI
  }
}

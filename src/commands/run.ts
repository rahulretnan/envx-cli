import { Command } from 'commander';

/**
 * Raw source entries collected from CLI flags, in the order they
 * should appear in the final merge pipeline.
 */
export type RawSource =
  | { kind: 'stage'; stage: string }
  | { kind: 'file'; path: string }
  | { kind: 'inline'; key: string; value: string };

/**
 * A source that has been resolved and its values loaded.
 */
export type LoadedSource = {
  origin: string; // human-readable, for dry-run / error messages
  encrypted: boolean;
  values: Record<string, string>;
};

/**
 * Raw options as Commander hands them to us. We accept `any` here
 * because Commander produces plain objects with dashed-flags
 * camel-cased (e.g. --dry-run → dryRun).
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RawRunOptions = any;

export const createRunCommand = (): Command => {
  const command = new Command('run');
  // Wiring happens in Task 13.
  return command;
};

export async function executeRun(
  _rawOptions: RawRunOptions,
  _childArgs: string[]
): Promise<void> {
  // Orchestrator body is added in Task 13.
  throw new Error('executeRun not yet implemented');
}

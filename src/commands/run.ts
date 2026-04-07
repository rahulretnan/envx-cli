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

/**
 * Parse a single `KEY=VALUE` string from the `--env` flag.
 * Throws with a descriptive message if the input is not in the
 * expected format.
 */
export function parseInlineEnv(input: string): { key: string; value: string } {
  const eq = input.indexOf('=');
  if (eq <= 0) {
    throw new Error(`--env requires KEY=VALUE format, got: ${input}`);
  }
  return {
    key: input.slice(0, eq),
    value: input.slice(eq + 1),
  };
}

/**
 * Collect raw sources from parsed CLI options into an ordered list.
 *
 * Order matters — it drives the merge pipeline later:
 *   1. -e stage (if any)
 *   2. -f files, in argv order
 *   3. --env inline overrides, in argv order
 *
 * Throws if any --env entry is malformed.
 */
export function collectRawSources(opts: RawRunOptions): RawSource[] {
  const sources: RawSource[] = [];

  if (opts.environment) {
    sources.push({ kind: 'stage', stage: String(opts.environment) });
  }

  if (Array.isArray(opts.envFile)) {
    for (const p of opts.envFile) {
      sources.push({ kind: 'file', path: String(p) });
    }
  }

  if (Array.isArray(opts.env)) {
    for (const kv of opts.env) {
      const { key, value } = parseInlineEnv(String(kv));
      sources.push({ kind: 'inline', key, value });
    }
  }

  return sources;
}

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

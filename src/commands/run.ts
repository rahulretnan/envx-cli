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

/**
 * Merge loaded sources and the parent env into a final env map,
 * applying dotenvx-style precedence.
 *
 * Without --overload (default): parent env values win on conflict.
 *   Files and inline overrides only fill in keys the parent doesn't
 *   already define. This makes `envx run -e prod -- npm start` safe
 *   to invoke from a shell that has NODE_ENV already set — existing
 *   values are preserved.
 *
 * With --overload: files and inline overrides win over the parent.
 *
 * Within the source list itself, later sources always beat earlier
 * sources (this is how inline --env ends up beating files — it sits
 * last in the list by construction in collectRawSources).
 *
 * The parent env is NOT mutated. The returned object is fresh.
 */
export function mergeEnv(
  loadedSources: LoadedSource[],
  parentEnv: Record<string, string | undefined>,
  overload: boolean
): Record<string, string> {
  // Walk sources in order; later wins.
  const fromSources: Record<string, string> = {};
  for (const source of loadedSources) {
    Object.assign(fromSources, source.values);
  }

  // Copy the parent so we never mutate it. Drop undefined values
  // (Node's process.env has `string | undefined` in its type but
  // only `string` values at runtime).
  const finalEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(parentEnv)) {
    if (typeof v === 'string') {
      finalEnv[k] = v;
    }
  }

  if (overload) {
    Object.assign(finalEnv, fromSources);
  } else {
    for (const [k, v] of Object.entries(fromSources)) {
      if (!(k in finalEnv)) {
        finalEnv[k] = v;
      }
    }
  }

  return finalEnv;
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

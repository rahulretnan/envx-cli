import { Command } from 'commander';
import path from 'path';
import { validateRunOptions } from '../schemas';
import { ExitCode } from '../types';
import { CliUtils, ExecUtils } from '../utils/exec';
import { FileUtils } from '../utils/file';
import { InteractiveUtils } from '../utils/interactive';

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
  origin: string;
  encrypted: boolean;
  values: Record<string, string>;
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type RawRunOptions = any;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Parse a single `KEY=VALUE` string from the `--env` flag.
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
 * Order: stage → files (argv order) → inline (argv order).
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
 * applying dotenvx-style precedence. Parent env is NOT mutated.
 */
export function mergeEnv(
  loadedSources: LoadedSource[],
  parentEnv: Record<string, string | undefined>,
  overload: boolean
): Record<string, string> {
  const fromSources: Record<string, string> = {};
  for (const source of loadedSources) {
    Object.assign(fromSources, source.values);
  }

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

/**
 * Build the --dry-run output string. Never includes decrypted values.
 */
export function formatDryRun(
  loadedSources: LoadedSource[],
  finalKeys: string[],
  overload: boolean,
  commandArgs: string[]
): string {
  const lines: string[] = [];

  lines.push('Sources (in merge order, lowest → highest priority):');
  if (loadedSources.length === 0) {
    lines.push('  (none)');
  } else {
    loadedSources.forEach((source, i) => {
      const kind = source.encrypted ? 'encrypted' : 'plain';
      const n = Object.keys(source.values).length;
      lines.push(`  ${i + 1}. ${source.origin} (${kind}, ${n} keys)`);
    });
  }

  lines.push(
    overload
      ? 'files+inline win on conflict (--overload)'
      : 'process.env wins on conflict (no --overload)'
  );

  const sortedKeys = [...finalKeys].sort();
  lines.push(`Would inject ${sortedKeys.length} unique key(s):`);
  for (const k of sortedKeys) {
    lines.push(`  ${k}`);
  }

  lines.push(`Would run: ${commandArgs.join(' ')}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Commander wiring
// ---------------------------------------------------------------------------

const collect =
  () =>
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  (value: string, previous: any) => {
    if (Array.isArray(previous)) {
      return [...previous, value];
    }
    return [value];
  };

export const createRunCommand = (): Command => {
  const command = new Command('run');

  command
    .description(
      'Decrypt an env file in memory and run a command with it injected'
    )
    .option(
      '-e, --environment <stage>',
      'Stage to load (resolves to .env.<stage>[.gpg] in cwd)'
    )
    .option(
      '-f, --env-file <path>',
      'Explicit env file (repeatable). .gpg suffix triggers decryption.',
      collect(),
      []
    )
    .option(
      '--env <KEY=VAL>',
      'Inline override; wins over files (use --overload to also override process.env) (repeatable)',
      collect(),
      []
    )
    .option(
      '-p, --passphrase <passphrase>',
      'GPG passphrase (encrypted sources)'
    )
    .option('-c, --cwd <path>', 'Working directory (default: process.cwd())')
    .option(
      '--overload',
      'Let files+inline override existing process.env values'
    )
    .option(
      '--dry-run',
      'Print what would be injected without running the command'
    )
    .allowUnknownOption(true)
    .passThroughOptions()
    .action(async (options, cmd: Command) => {
      try {
        await executeRun(options, cmd.args);
      } catch (error) {
        CliUtils.error(
          `Run failed: ${error instanceof Error ? error.message : String(error)}`
        );
        const exit =
          (error as { exitCode?: number }).exitCode ?? ExitCode.GENERAL_ERROR;
        process.exit(exit);
      }
    });

  return command;
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Tag errors with a specific exit code so the action handler can use it.
 */
class RunError extends Error {
  constructor(
    message: string,
    public exitCode: ExitCode
  ) {
    super(message);
  }
}

export async function executeRun(
  rawOptions: RawRunOptions,
  childArgs: string[]
): Promise<void> {
  // 1. Validate option shape via Zod.
  validateRunOptions(rawOptions);

  // 2. Resolve cwd.
  const cwd = rawOptions.cwd
    ? path.resolve(rawOptions.cwd)
    : ExecUtils.getCurrentDir();

  // 3. Collect raw sources.
  const rawSources = collectRawSources(rawOptions);

  if (rawSources.length === 0) {
    throw new RunError(
      'At least one of --environment, --env-file, or --env is required',
      ExitCode.INVALID_ARGS
    );
  }

  if (childArgs.length === 0) {
    throw new RunError(
      'No command specified. Usage: envx run [options] -- <command>',
      ExitCode.INVALID_ARGS
    );
  }

  // 4. Resolve each raw source.
  type ResolvedSource =
    | { kind: 'file'; origin: string; path: string; encrypted: boolean }
    | { kind: 'inline'; origin: string; values: Record<string, string> };

  const resolved: ResolvedSource[] = [];

  for (const raw of rawSources) {
    if (raw.kind === 'stage') {
      const file = await FileUtils.resolveStageFile(raw.stage, cwd);
      if (!file) {
        throw new RunError(
          `No env file found for stage '${raw.stage}' in ${cwd}. Looked for .env.${raw.stage}.gpg and .env.${raw.stage}`,
          ExitCode.FILE_ERROR
        );
      }
      resolved.push({
        kind: 'file',
        origin: path.relative(cwd, file.path) || path.basename(file.path),
        path: file.path,
        encrypted: file.encrypted,
      });
    } else if (raw.kind === 'file') {
      const abs = path.resolve(cwd, raw.path);
      if (!(await FileUtils.fileExists(abs))) {
        throw new RunError(`Env file not found: ${abs}`, ExitCode.FILE_ERROR);
      }
      resolved.push({
        kind: 'file',
        origin: path.relative(cwd, abs) || path.basename(abs),
        path: abs,
        encrypted: abs.endsWith('.gpg'),
      });
    } else {
      resolved.push({
        kind: 'inline',
        origin: '--env',
        values: { [raw.key]: raw.value },
      });
    }
  }

  // 5. Resolve passphrase only if any source is encrypted.
  const hasEncrypted = resolved.some(r => r.kind === 'file' && r.encrypted);
  let passphrase: string | undefined;
  if (hasEncrypted) {
    if (rawOptions.passphrase) {
      passphrase = String(rawOptions.passphrase);
    } else {
      const envrc = await FileUtils.readEnvrc(cwd);
      const stageSource = rawSources.find(
        (r): r is { kind: 'stage'; stage: string } => r.kind === 'stage'
      );
      if (stageSource) {
        const varName = FileUtils.generateSecretVariableName(stageSource.stage);
        if (envrc[varName]) {
          passphrase = envrc[varName];
        }
      }
      if (!passphrase) {
        passphrase = await InteractiveUtils.promptPassphrase(
          'Enter GPG passphrase:'
        );
      }
    }
  }

  // 6. Load file contents; build LoadedSource list.
  const loadedSources: LoadedSource[] = [];
  for (const r of resolved) {
    if (r.kind === 'inline') {
      loadedSources.push({
        origin: r.origin,
        encrypted: false,
        values: r.values,
      });
      continue;
    }

    try {
      const values = await FileUtils.loadEnvSource(
        { path: r.path, encrypted: r.encrypted },
        passphrase
      );
      loadedSources.push({
        origin: r.origin,
        encrypted: r.encrypted,
        values,
      });
    } catch (err) {
      throw new RunError(
        err instanceof Error ? err.message : String(err),
        ExitCode.GPG_ERROR
      );
    }
  }

  // 7. Merge with precedence rules.
  const finalEnv = mergeEnv(loadedSources, process.env, !!rawOptions.overload);

  // 8. --dry-run: print and exit 0, do not spawn.
  if (rawOptions.dryRun) {
    const injectedKeys = new Set<string>();
    for (const s of loadedSources) {
      for (const k of Object.keys(s.values)) {
        injectedKeys.add(k);
      }
    }
    console.log(
      formatDryRun(
        [...loadedSources],
        [...injectedKeys],
        !!rawOptions.overload,
        childArgs
      )
    );
    return;
  }

  // 9. Spawn the sub-process and propagate its exit code.
  let exitCode: number;
  try {
    exitCode = await ExecUtils.spawnChildWithEnv(childArgs, finalEnv, cwd);
  } catch (err) {
    throw new RunError(
      err instanceof Error ? err.message : String(err),
      ExitCode.GENERAL_ERROR
    );
  }
  process.exit(exitCode);
}

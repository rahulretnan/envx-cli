import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import https from 'https';
import os from 'os';
import path from 'path';

interface UpdateCache {
  lastCheck: number;
  latest: string;
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const REGISTRY_URL = 'https://registry.npmjs.org/envx-cli/latest';
const REQUEST_TIMEOUT_MS = 3000;

// A version string reaches the TTY (getUpdateNote) from two untrusted sources:
// the npm registry response and ~/.envx/update.json on disk. parseVersion is
// not a sanitizer ("999.0.0]0;pwned" parses to [999,0,0]), so gate both trust
// boundaries on this shape to keep control bytes off the terminal.
const VALID_VERSION = /^[0-9A-Za-z.+-]{1,32}$/;

function isValidVersion(v: unknown): v is string {
  return typeof v === 'string' && VALID_VERSION.test(v);
}

function getCachePath(): string {
  return path.join(os.homedir(), '.envx', 'update.json');
}

// Parse up to three dotted integer parts; parseInt stops at the first
// non-digit, so "6-beta" -> 6. Missing parts count as 0. NaN -> invalid.
function parseVersion(v: string): [number, number, number] | null {
  const parts = String(v)
    .split('.')
    .slice(0, 3)
    .map(p => parseInt(p, 10));
  while (parts.length < 3) {
    parts.push(0);
  }
  if (parts.some(n => Number.isNaN(n))) {
    return null;
  }
  return [parts[0], parts[1], parts[2]];
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) {
    return false;
  }
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) {
      return true;
    }
    if (a[i] < b[i]) {
      return false;
    }
  }
  return false;
}

export function readCache(): UpdateCache | null {
  try {
    const raw = fs.readFileSync(getCachePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      isValidVersion(parsed.latest) &&
      typeof parsed.lastCheck === 'number'
    ) {
      return parsed as UpdateCache;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCache(latest: string): void {
  try {
    const file = getCachePath();
    fs.ensureDirSync(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify({ lastCheck: Date.now(), latest }));
  } catch {
    // best-effort; a failed cache write just means we re-check next time
  }
}

export function getUpdateNote(current: string): string | null {
  const cache = readCache();
  if (cache && isNewer(cache.latest, current)) {
    return chalk.dim(
      `ℹ Update available ${current} → ${cache.latest} · run: npm i -g envx-cli`
    );
  }
  return null;
}

// Fire-and-forget refresh. Never blocks or delays the parent process.
export function maybeRefreshInBackground(): void {
  try {
    const cache = readCache();
    const stale = !cache || Date.now() - cache.lastCheck > CHECK_INTERVAL_MS;
    if (!stale) {
      return;
    }
    // Only meaningful for the built binary; under ts-node/jest __filename
    // is a .ts file and re-spawning node on it would fail, so skip.
    if (!__filename.endsWith('.js')) {
      return;
    }

    const child = spawn(process.execPath, [__filename, '--update-worker'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    // An async spawn failure (EMFILE/EACCES/EPERM) emits 'error' on the child;
    // an unhandled 'error' on an EventEmitter throws, which would crash the CLI.
    child.on('error', () => {});
    child.unref();
  } catch {
    // never let a background refresh affect the CLI
  }
}

// Worker: fetch latest version and update the cache, then exit.
function runWorker(): void {
  const req = https.get(REGISTRY_URL, res => {
    if (res.statusCode !== 200) {
      res.resume();
      process.exit(0);
    }
    let body = '';
    res.setEncoding('utf-8');
    res.on('data', chunk => (body += chunk));
    res.on('error', () => process.exit(0));
    res.on('end', () => {
      try {
        const version = JSON.parse(body).version;
        if (isValidVersion(version)) {
          writeCache(version);
        }
      } catch {
        // ignore parse errors
      }
      process.exit(0);
    });
  });
  req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy());
  req.on('error', () => process.exit(0));
}

if (require.main === module && process.argv.includes('--update-worker')) {
  runWorker();
}

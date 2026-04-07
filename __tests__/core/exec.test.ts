import * as cp from 'child_process';

// chalk is ESM-only (v5). Mock it so Jest (CJS mode) can load exec.ts.
jest.mock('chalk', () => ({
  default: {
    blue: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    cyan: Object.assign((s: string) => s, {
      bold: { cyan: (s: string) => s },
    }),
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
    }),
    magenta: (s: string) => s,
  },
}));

import { ExecUtils } from '../../src/utils/exec';

jest.mock('child_process');

const mockedExecFileSync = cp.execFileSync as jest.MockedFunction<
  typeof cp.execFileSync
>;

describe('ExecUtils.decryptFileToString', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return content on successful decryption', () => {
    mockedExecFileSync.mockReturnValue(
      'FOO=bar\nBAZ=qux\n' as unknown as Buffer
    );

    const result = ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    expect(result.success).toBe(true);
    expect(result.content).toBe('FOO=bar\nBAZ=qux\n');
    expect(result.error).toBeUndefined();
  });

  it('should invoke gpg with decrypt flag and encrypted path as separate args', () => {
    mockedExecFileSync.mockReturnValue('' as unknown as Buffer);

    ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
    const call = mockedExecFileSync.mock.calls[0];
    expect(call[0]).toBe('gpg');
    const args = call[1] as string[];
    expect(args).toContain('-d');
    expect(args).toContain('/tmp/file.gpg');
    expect(args).toContain('--passphrase');
    expect(args).toContain('secret');
    // Must not contain any -o output flag (decrypt goes to stdout).
    expect(args).not.toContain('-o');
  });

  it('should use stdio that captures stdout, not inherit', () => {
    mockedExecFileSync.mockReturnValue('CONTENT' as unknown as Buffer);

    ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    const options = mockedExecFileSync.mock.calls[0][2] as {
      stdio?: unknown;
    };
    expect(options.stdio).not.toBe('inherit');
  });

  it('should return failure when gpg throws with stderr', () => {
    const err = new Error(
      'gpg: decryption failed: Bad session key'
    ) as Error & {
      stderr?: Buffer;
    };
    err.stderr = Buffer.from('gpg: decryption failed: Bad session key\n');
    mockedExecFileSync.mockImplementation(() => {
      throw err;
    });

    const result = ExecUtils.decryptFileToString('/tmp/file.gpg', 'wrong');

    expect(result.success).toBe(false);
    expect(result.content).toBeUndefined();
    expect(result.error).toContain('Bad session key');
  });

  it('should fall back to error.message when stderr is missing', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('spawn gpg ENOENT');
    });

    const result = ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
  });
});

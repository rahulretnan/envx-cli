import * as cp from 'child_process';
import { ExecUtils } from '../../src/utils/exec';

jest.mock('child_process');

const mockedSpawnSync = cp.spawnSync as jest.MockedFunction<
  typeof cp.spawnSync
>;

// Helper: build a fake SpawnSyncReturns with the fields our code reads.
const fakeSpawnResult = (overrides: {
  status: number | null;
  stdout?: string;
  stderr?: string | Buffer;
  error?: Error;
}) =>
  ({
    pid: 0,
    output: ['', overrides.stdout ?? '', overrides.stderr ?? ''],
    stdout: overrides.stdout ?? '',
    stderr: overrides.stderr ?? '',
    status: overrides.status,
    signal: null,
    error: overrides.error,
  }) as unknown as ReturnType<typeof cp.spawnSync>;

describe('ExecUtils.decryptFileToString', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return content on successful decryption', () => {
    mockedSpawnSync.mockReturnValue(
      fakeSpawnResult({ status: 0, stdout: 'FOO=bar\nBAZ=qux\n' })
    );

    const result = ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    expect(result.success).toBe(true);
    expect(result.content).toBe('FOO=bar\nBAZ=qux\n');
    expect(result.error).toBeUndefined();
  });

  it('should invoke gpg with --passphrase-fd and --pinentry-mode loopback', () => {
    mockedSpawnSync.mockReturnValue(fakeSpawnResult({ status: 0 }));

    ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    expect(mockedSpawnSync).toHaveBeenCalledTimes(1);
    const call = mockedSpawnSync.mock.calls[0];
    expect(call[0]).toBe('gpg');
    const args = call[1] as string[];
    expect(args).toContain('-d');
    expect(args).toContain('/tmp/file.gpg');
    expect(args).toContain('--passphrase-fd');
    expect(args).toContain('0');
    expect(args).toContain('--pinentry-mode');
    expect(args).toContain('loopback');
    // Must not contain any -o output flag (decrypt goes to stdout).
    expect(args).not.toContain('-o');
  });

  it('should NEVER place the passphrase in argv', () => {
    mockedSpawnSync.mockReturnValue(fakeSpawnResult({ status: 0 }));

    ExecUtils.decryptFileToString('/tmp/file.gpg', 'my-secret-passphrase');

    const args = mockedSpawnSync.mock.calls[0][1] as string[];
    expect(args).not.toContain('my-secret-passphrase');
    expect(args).not.toContain('--passphrase');
  });

  it('should pass the passphrase via spawnSync input (stdin)', () => {
    mockedSpawnSync.mockReturnValue(fakeSpawnResult({ status: 0 }));

    ExecUtils.decryptFileToString('/tmp/file.gpg', 'my-secret-passphrase');

    const options = mockedSpawnSync.mock.calls[0][2] as { input?: unknown };
    expect(options.input).toBe('my-secret-passphrase');
  });

  it('should use stdio that captures stdout, not inherit', () => {
    mockedSpawnSync.mockReturnValue(
      fakeSpawnResult({ status: 0, stdout: 'CONTENT' })
    );

    ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    const options = mockedSpawnSync.mock.calls[0][2] as { stdio?: unknown };
    expect(options.stdio).not.toBe('inherit');
  });

  it('should return failure when gpg exits non-zero with stderr', () => {
    mockedSpawnSync.mockReturnValue(
      fakeSpawnResult({
        status: 2,
        stderr: 'gpg: decryption failed: Bad session key\n',
      })
    );

    const result = ExecUtils.decryptFileToString('/tmp/file.gpg', 'wrong');

    expect(result.success).toBe(false);
    expect(result.content).toBeUndefined();
    expect(result.error).toContain('Bad session key');
  });

  it('should return a fallback message when gpg exits non-zero with no stderr', () => {
    mockedSpawnSync.mockReturnValue(fakeSpawnResult({ status: 2 }));

    const result = ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    expect(result.success).toBe(false);
    expect(result.error).toContain('gpg exited with code 2');
  });

  it('should return failure when spawn itself fails (binary not found)', () => {
    mockedSpawnSync.mockReturnValue(
      fakeSpawnResult({
        status: null,
        error: new Error('spawn gpg ENOENT'),
      })
    );

    const result = ExecUtils.decryptFileToString('/tmp/file.gpg', 'secret');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
  });
});

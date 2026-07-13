import {
  pickTip,
  printAdvisories,
  shouldShowHints,
  TIPS,
} from '../../src/utils/hints';

describe('shouldShowHints', () => {
  const realTTY = process.stdout.isTTY;
  const realCI = process.env.CI;
  const realNoHints = process.env.ENVX_NO_HINTS;

  beforeEach(() => {
    (process.stdout as { isTTY?: boolean }).isTTY = true;
    delete process.env.CI;
    delete process.env.ENVX_NO_HINTS;
  });

  afterEach(() => {
    (process.stdout as { isTTY?: boolean }).isTTY = realTTY;
    if (realCI === undefined) {
      delete process.env.CI;
    } else {
      process.env.CI = realCI;
    }
    if (realNoHints === undefined) {
      delete process.env.ENVX_NO_HINTS;
    } else {
      process.env.ENVX_NO_HINTS = realNoHints;
    }
  });

  it('allows hints when TTY and nothing suppresses', () => {
    expect(shouldShowHints({})).toBe(true);
  });

  it('suppresses when quiet', () => {
    expect(shouldShowHints({ quiet: true })).toBe(false);
  });

  it('suppresses when ENVX_NO_HINTS is set', () => {
    process.env.ENVX_NO_HINTS = '1';
    expect(shouldShowHints({})).toBe(false);
  });

  it('suppresses in CI', () => {
    process.env.CI = 'true';
    expect(shouldShowHints({})).toBe(false);
  });

  it('suppresses when not a TTY', () => {
    (process.stdout as { isTTY?: boolean }).isTTY = false;
    expect(shouldShowHints({})).toBe(false);
  });
});

describe('pickTip', () => {
  it('returns a member of TIPS', () => {
    expect(TIPS).toContain(pickTip());
  });
});

describe('printAdvisories', () => {
  let logs: string[];
  let spy: jest.SpyInstance;

  beforeEach(() => {
    logs = [];
    spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
  });

  afterEach(() => {
    spy.mockRestore();
    (process.stdout as { isTTY?: boolean }).isTTY = true;
  });

  it('prints nothing when the gate is closed', () => {
    (process.stdout as { isTTY?: boolean }).isTTY = false;
    printAdvisories({}, '1.5.0');
    expect(logs).toHaveLength(0);
  });

  it('prints a tip when the gate is open', () => {
    (process.stdout as { isTTY?: boolean }).isTTY = true;
    delete process.env.CI;
    delete process.env.ENVX_NO_HINTS;
    printAdvisories({}, '1.5.0');
    expect(logs.join('\n')).toContain('💡');
  });
});

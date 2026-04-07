import { collectRawSources, parseInlineEnv } from '../../src/commands/run';

describe('parseInlineEnv', () => {
  it('should parse KEY=value', () => {
    expect(parseInlineEnv('FOO=bar')).toEqual({ key: 'FOO', value: 'bar' });
  });

  it('should allow empty value', () => {
    expect(parseInlineEnv('FOO=')).toEqual({ key: 'FOO', value: '' });
  });

  it('should preserve = signs inside the value', () => {
    expect(
      parseInlineEnv('CONN=postgres://user:pass@host/db?ssl=true')
    ).toEqual({
      key: 'CONN',
      value: 'postgres://user:pass@host/db?ssl=true',
    });
  });

  it('should reject strings without =', () => {
    expect(() => parseInlineEnv('FOO')).toThrow(/KEY=VALUE format/);
  });

  it('should reject empty key', () => {
    expect(() => parseInlineEnv('=bar')).toThrow(/KEY=VALUE format/);
  });

  it('should include the offending input in the error message', () => {
    expect(() => parseInlineEnv('nope')).toThrow(/nope/);
  });
});

describe('collectRawSources', () => {
  it('should return an empty list when no sources are given', () => {
    expect(collectRawSources({})).toEqual([]);
  });

  it('should include a stage entry first when -e is given', () => {
    const result = collectRawSources({ environment: 'production' });
    expect(result).toEqual([{ kind: 'stage', stage: 'production' }]);
  });

  it('should include file entries in argv order after the stage', () => {
    const result = collectRawSources({
      environment: 'production',
      envFile: ['.env.a', '.env.b'],
    });
    expect(result).toEqual([
      { kind: 'stage', stage: 'production' },
      { kind: 'file', path: '.env.a' },
      { kind: 'file', path: '.env.b' },
    ]);
  });

  it('should include inline entries last, in argv order', () => {
    const result = collectRawSources({
      environment: 'prod',
      env: ['FOO=1', 'BAR=2'],
    });
    expect(result).toEqual([
      { kind: 'stage', stage: 'prod' },
      { kind: 'inline', key: 'FOO', value: '1' },
      { kind: 'inline', key: 'BAR', value: '2' },
    ]);
  });

  it('should support all three kinds together in the correct order', () => {
    const result = collectRawSources({
      environment: 'staging',
      envFile: ['override.env'],
      env: ['LOG_LEVEL=debug'],
    });
    expect(result).toEqual([
      { kind: 'stage', stage: 'staging' },
      { kind: 'file', path: 'override.env' },
      { kind: 'inline', key: 'LOG_LEVEL', value: 'debug' },
    ]);
  });

  it('should propagate errors from bad --env format', () => {
    expect(() => collectRawSources({ env: ['badformat'] })).toThrow(
      /KEY=VALUE format/
    );
  });
});

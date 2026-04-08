import {
  collectRawSources,
  formatDryRun,
  mergeEnv,
  parseInlineEnv,
  type LoadedSource,
} from '../../src/commands/run';

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

describe('mergeEnv', () => {
  const makeSource = (
    values: Record<string, string>,
    origin = 'test'
  ): LoadedSource => ({
    origin,
    encrypted: false,
    values,
  });

  it('should merge a single source with an empty parent', () => {
    const result = mergeEnv([makeSource({ FOO: 'bar' })], {}, false);
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('should have later sources override earlier sources', () => {
    const result = mergeEnv(
      [makeSource({ FOO: 'first' }), makeSource({ FOO: 'second' })],
      {},
      false
    );
    expect(result.FOO).toBe('second');
  });

  it('should preserve process.env values on conflict when overload is off (default)', () => {
    const parent = { FOO: 'from-shell', PATH: '/usr/bin' };
    const result = mergeEnv([makeSource({ FOO: 'from-file' })], parent, false);
    expect(result.FOO).toBe('from-shell');
    expect(result.PATH).toBe('/usr/bin');
  });

  it('should add file keys that are NOT in process.env even without overload', () => {
    const parent = { PATH: '/usr/bin' };
    const result = mergeEnv([makeSource({ NEW_KEY: 'hello' })], parent, false);
    expect(result.NEW_KEY).toBe('hello');
    expect(result.PATH).toBe('/usr/bin');
  });

  it('should override process.env when overload is on', () => {
    const parent = { FOO: 'from-shell' };
    const result = mergeEnv([makeSource({ FOO: 'from-file' })], parent, true);
    expect(result.FOO).toBe('from-file');
  });

  it('should include inline values and have them beat files in the source list', () => {
    const result = mergeEnv(
      [
        makeSource({ FOO: 'from-file' }, 'file'),
        makeSource({ FOO: 'from-inline' }, 'inline'),
      ],
      {},
      false
    );
    expect(result.FOO).toBe('from-inline');
  });

  it('should still let process.env beat inline when overload is off', () => {
    const parent = { FOO: 'from-shell' };
    const result = mergeEnv(
      [makeSource({ FOO: 'from-inline' }, 'inline')],
      parent,
      false
    );
    expect(result.FOO).toBe('from-shell');
  });

  it('should let inline beat process.env when overload is on', () => {
    const parent = { FOO: 'from-shell' };
    const result = mergeEnv(
      [makeSource({ FOO: 'from-inline' }, 'inline')],
      parent,
      true
    );
    expect(result.FOO).toBe('from-inline');
  });

  it('should NOT mutate the parent env object', () => {
    const parent: Record<string, string> = { FOO: 'original' };
    mergeEnv([makeSource({ FOO: 'changed', NEW: 'added' })], parent, true);
    expect(parent).toEqual({ FOO: 'original' });
  });
});

describe('formatDryRun', () => {
  const src = (
    origin: string,
    encrypted: boolean,
    values: Record<string, string>
  ): LoadedSource => ({
    origin,
    encrypted,
    values,
  });

  it('should list each source with origin, encryption status, and key count', () => {
    const output = formatDryRun(
      [
        src('.env.production.gpg', true, { A: '1', B: '2' }),
        src('.env.overrides', false, { C: '3' }),
      ],
      ['A', 'B', 'C'],
      false,
      ['npm', 'start']
    );
    expect(output).toContain('.env.production.gpg (encrypted, 2 keys)');
    expect(output).toContain('.env.overrides (plain, 1 keys)');
  });

  it('should state the precedence mode (no overload vs overload)', () => {
    const noOverload = formatDryRun([], [], false, ['npm', 'start']);
    const overload = formatDryRun([], [], true, ['npm', 'start']);
    expect(noOverload).toContain(
      'process.env wins on conflict (no --overload)'
    );
    expect(overload).toContain('files+inline win on conflict (--overload)');
  });

  it('should print the unique key list sorted', () => {
    const output = formatDryRun(
      [src('f', false, { ZZZ: '1', AAA: '2', MMM: '3' })],
      ['AAA', 'MMM', 'ZZZ'],
      false,
      ['node', 'server.js']
    );
    const zIdx = output.indexOf('ZZZ');
    const aIdx = output.indexOf('AAA');
    const mIdx = output.indexOf('MMM');
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  it('should print the command that would run', () => {
    const output = formatDryRun([], ['X'], false, ['npm', 'test', '--watch']);
    expect(output).toContain('npm test --watch');
  });

  it('should NEVER print values (secret leak guard)', () => {
    const output = formatDryRun(
      [src('.env.production.gpg', true, { DB_PASSWORD: 'hunter2' })],
      ['DB_PASSWORD'],
      false,
      ['npm', 'start']
    );
    expect(output).not.toContain('hunter2');
    expect(output).toContain('DB_PASSWORD');
  });

  it('should handle empty source list and empty key list', () => {
    const output = formatDryRun([], [], false, ['echo', 'hi']);
    expect(output).toContain('Would inject 0 unique key(s)');
  });
});

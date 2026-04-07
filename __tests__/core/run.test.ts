import { parseInlineEnv } from '../../src/commands/run';

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

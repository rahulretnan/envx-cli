import {
  envxrcFileConfigSchema,
  registeredFileSchema,
} from '../../src/schemas';

describe('registeredFileSchema', () => {
  it('accepts a global file entry', () => {
    expect(registeredFileSchema.parse({ path: 'certs/signing.p12' })).toEqual({
      path: 'certs/signing.p12',
    });
  });

  it('accepts a stage-bound entry', () => {
    expect(
      registeredFileSchema.parse({
        path: 'android/google-services.json',
        stage: 'production',
      })
    ).toEqual({
      path: 'android/google-services.json',
      stage: 'production',
    });
  });

  it('rejects POSIX absolute paths', () => {
    expect(() =>
      registeredFileSchema.parse({ path: '/etc/secret.json' })
    ).toThrow();
  });

  it('rejects Windows absolute paths', () => {
    expect(() =>
      registeredFileSchema.parse({ path: 'C:\\secret.json' })
    ).toThrow();
  });

  it('rejects .gpg paths', () => {
    expect(() =>
      registeredFileSchema.parse({ path: 'certs/signing.p12.gpg' })
    ).toThrow();
  });

  it('rejects paths escaping the root', () => {
    expect(() =>
      registeredFileSchema.parse({ path: '../outside.json' })
    ).toThrow();
    expect(() =>
      registeredFileSchema.parse({ path: 'certs/../../outside.json' })
    ).toThrow();
  });

  it('rejects empty paths', () => {
    expect(() => registeredFileSchema.parse({ path: '' })).toThrow();
  });

  it('rejects invalid stage names', () => {
    expect(() =>
      registeredFileSchema.parse({ path: 'a.json', stage: 'pro d' })
    ).toThrow();
  });
});

describe('envxrcFileConfigSchema files field', () => {
  it('accepts a config with files', () => {
    const config = {
      ignore: ['example'],
      files: [
        { path: 'certs/signing.p12' },
        { path: 'android/google-services.json', stage: 'production' },
      ],
    };
    expect(envxrcFileConfigSchema.parse(config)).toEqual(config);
  });

  it('still accepts a config without files', () => {
    expect(envxrcFileConfigSchema.parse({})).toEqual({});
  });

  it('rejects a files array with an invalid entry', () => {
    expect(() =>
      envxrcFileConfigSchema.parse({ files: [{ path: '/abs.json' }] })
    ).toThrow();
  });
});

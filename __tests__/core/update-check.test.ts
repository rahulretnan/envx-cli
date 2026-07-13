import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  getUpdateNote,
  isNewer,
  readCache,
  writeCache,
} from '../../src/utils/update-check';

describe('isNewer', () => {
  it.each([
    ['1.6.0', '1.5.0', true],
    ['1.5.0', '1.5.0', false],
    ['1.5.0', '1.6.0', false],
    ['1.5.1', '1.5.0', true],
    ['2.0.0', '1.9.9', true],
    ['1.6', '1.5.9', true],
    ['1.6.0-beta.1', '1.5.0', true],
    ['garbage', '1.5.0', false],
    ['1.5.0', 'garbage', false],
  ])('isNewer(%s, %s) === %s', (latest, current, expected) => {
    expect(isNewer(latest, current)).toBe(expected);
  });
});

describe('cache', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'envx-upd-'));
    jest.spyOn(os, 'homedir').mockReturnValue(tmp);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.remove(tmp);
  });

  it('round-trips through writeCache/readCache', () => {
    writeCache('1.6.0');
    const cache = readCache();
    expect(cache?.latest).toBe('1.6.0');
    expect(typeof cache?.lastCheck).toBe('number');
  });

  it('readCache returns null when the file is missing', () => {
    expect(readCache()).toBeNull();
  });

  it('readCache returns null on corrupt JSON', async () => {
    await fs.ensureDir(path.join(tmp, '.envx'));
    await fs.writeFile(path.join(tmp, '.envx', 'update.json'), 'not json');
    expect(readCache()).toBeNull();
  });

  it('getUpdateNote returns a note only when cache is newer', () => {
    writeCache('1.6.0');
    expect(getUpdateNote('1.5.0')).toContain('1.5.0');
    expect(getUpdateNote('1.5.0')).toContain('1.6.0');
    expect(getUpdateNote('1.6.0')).toBeNull();
  });
});

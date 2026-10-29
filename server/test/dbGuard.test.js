import { describe, expect, it } from 'vitest';
import { assertDbHostAllowed, assertDbTargetAllowed, isProdDbHost } from '../src/config/dbGuard.js';

describe('正式機資料庫防呆', () => {
  it('辨識正式機各種寫法', () => {
    expect(isProdDbHost('172.16.29.1')).toBe(true);
    expect(isProdDbHost(' 172.16.29.1 ')).toBe(true);
    expect(isProdDbHost('172.16.29.1,1433')).toBe(true);
    expect(isProdDbHost('172.16.29.1:1433')).toBe(true);
    expect(isProdDbHost('172.16.29.1\\SQLEXPRESS')).toBe(true);
    expect(isProdDbHost('172.16.29.10')).toBe(false);
    expect(isProdDbHost('localhost')).toBe(false);
  });

  it('非 production 模式連正式機會拒絕', () => {
    expect(() => assertDbHostAllowed('development', '172.16.29.1')).toThrow(/DB 防呆/);
    expect(() => assertDbHostAllowed('test', '172.16.29.1')).toThrow(/DB 防呆/);
  });

  it('網域名稱解析到正式機時拒絕', async () => {
    const toProd = async () => [{ address: '172.16.29.1' }];
    const toTest = async () => [{ address: '120.96.34.83' }];
    const fail = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(assertDbTargetAllowed('development', 'db.example', toProd)).rejects.toThrow(
      /解析為正式機/,
    );
    await expect(
      assertDbTargetAllowed('development', 'db.example', toTest),
    ).resolves.toBeUndefined();
    await expect(assertDbTargetAllowed('development', 'db.example', fail)).resolves.toBeUndefined();
    await expect(
      assertDbTargetAllowed('production', 'db.example', toProd),
    ).resolves.toBeUndefined();
  });

  it('production 模式或測試機可通過', () => {
    expect(() => assertDbHostAllowed('production', '172.16.29.1')).not.toThrow();
    expect(() => assertDbHostAllowed('development', 'test-db.local')).not.toThrow();
  });
});

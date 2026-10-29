import { describe, expect, it } from 'vitest';
import { resolveModeEnv, sourceKey } from '../src/config/modeEnv.js';

const src = {
  DB_HOST: '172.16.29.1',
  DB_USER: 'prod_user',
  ADMIN_ACCOUNTS: 'ot088',
  TEST_DB_HOST: 'test-db',
  TEST_DB_USER: 'test_user',
  TEST_ADMIN_ACCOUNTS: 'ot088,sharon',
  LDAP_URL: 'ldap://x',
};

describe('依模式選擇正式／測試參數', () => {
  it('production 讀 DB_*', () => {
    const env = resolveModeEnv({ ...src, NODE_ENV: 'production' });
    expect(env.DB_HOST).toBe('172.16.29.1');
    expect(env.DB_USER).toBe('prod_user');
    expect(env.ADMIN_ACCOUNTS).toBe('ot088');
  });

  it('development 讀 TEST_DB_*', () => {
    const env = resolveModeEnv({ ...src, NODE_ENV: 'development' });
    expect(env.DB_HOST).toBe('test-db');
    expect(env.DB_USER).toBe('test_user');
    expect(env.ADMIN_ACCOUNTS).toBe('ot088,sharon');
    expect(env.LDAP_URL).toBe('ldap://x');
  });

  it('測試參數沒填時不會退回使用正式參數', () => {
    const env = resolveModeEnv({ DB_HOST: '172.16.29.1', NODE_ENV: 'development' });
    expect(env.DB_HOST).toBeUndefined();
  });

  it('sourceKey 顯示實際讀取的參數名稱', () => {
    expect(sourceKey('DB_HOST', 'development')).toBe('TEST_DB_HOST');
    expect(sourceKey('DB_HOST', 'production')).toBe('DB_HOST');
    expect(sourceKey('JWT_SECRET', 'development')).toBe('JWT_SECRET');
  });
});

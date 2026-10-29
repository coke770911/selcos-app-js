import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 測試用的固定參數（不讀 server/.env，也不會連任何資料庫或 AD）
    env: {
      NODE_ENV: 'test',
      TEST_DB_HOST: 'unit-test.invalid',
      TEST_DB_USER: 'unit',
      TEST_DB_PASS: 'unit',
      TEST_ADMIN_ACCOUNTS: 'fz083,ot088',
      LDAP_URL: 'ldap://unit-test.invalid',
      LDAP_DOMAIN: 'acc.ad',
      JWT_SECRET: 'unit-test-secret-unit-test-secret-1234',
      LOG_LEVEL: 'fatal',
    },
  },
});

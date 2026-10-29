import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { loadEnvFile } from './loadEnv.js';
import { assertDbHostAllowed } from './dbGuard.js';
import { isProductionMode, resolveModeEnv, sourceKey } from './modeEnv.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// 單元測試不讀 server/.env，參數由 vitest.config.js 提供，避免受本機設定影響
export const envFileLoaded = process.env.NODE_ENV === 'test' ? false : loadEnvFile(serverRoot);

const csv = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );

// 依模式不同的預設值（舊系統寫在 common.php 的 TESTMODE 判斷）
const prod = isProductionMode(process.env.NODE_ENV);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_TITLE_SUFFIX: z.string().default(prod ? '' : '[測試]'),

  // 選課可用時間（秒），舊系統 $SYSTEMTIME：正式 30 分鐘、測試 5 小時
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(prod ? 1800 : 18000),
  // 可代登的管理員帳號，舊系統 $adminArray（測試模式讀 TEST_ADMIN_ACCOUNTS）
  ADMIN_ACCOUNTS: csv,

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().min(1).default('OIT'),
  DB_USER: z.string().min(1),
  DB_PASS: z.string().min(1),
  DB_ENCRYPT: z.stringbool().default(true),
  DB_TRUST_SERVER_CERT: z.stringbool().default(true),

  LDAP_URL: z.string().min(1),
  LDAP_DOMAIN: z.string().min(1),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少 32 字元'),
  // sqlserver：[CACHE].[dbo].[tb_Session]，負載平衡下多台伺服器共用；memory：限單一程序
  CACHE_DRIVER: z.enum(['sqlserver', 'memory']).default('sqlserver'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default(prod ? 'info' : 'debug'),
});

/** @typedef {z.infer<typeof schema>} Env */

/** @returns {Env} */
function parse() {
  // 正式模式讀 DB_*，其他模式讀 TEST_DB_*
  const result = schema.safeParse(resolveModeEnv(process.env));
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `  - ${sourceKey(i.path.join('.'), process.env.NODE_ENV)}: ${i.message}`,
    );
    throw new Error(
      `環境參數錯誤（NODE_ENV=${process.env.NODE_ENV}，server/.env ${envFileLoaded ? '已載入' : '不存在'}）\n${issues.join('\n')}`,
    );
  }
  assertDbHostAllowed(result.data.NODE_ENV, result.data.DB_HOST);
  return result.data;
}

export const env = parse();
export const isProduction = env.NODE_ENV === 'production';

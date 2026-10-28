import type { config as MssqlConfig } from 'mssql';
import type { Env } from '../config/env.js';

/** mssql 連線設定，Prisma adapter 與檢查腳本共用 */
export function buildMssqlConfig(env: Env): MssqlConfig {
  return {
    server: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASS,
    options: {
      encrypt: env.DB_ENCRYPT,
      trustServerCertificate: env.DB_TRUST_SERVER_CERT,
      // 資料庫的 datetime 存台灣本地時間，不當成 UTC 解讀
      useUTC: false,
    },
    pool: { max: 20, min: 0, idleTimeoutMillis: 30_000 },
  };
}

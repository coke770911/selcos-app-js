import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';
import { loadEnvFile } from './src/config/loadEnv.js';
import { assertDbTargetAllowed } from './src/config/dbGuard.js';
import { resolveModeEnv } from './src/config/modeEnv.js';

// Prisma CLI 與 API 共用 server/.env；正式模式讀 DB_*，其他模式讀 TEST_DB_*
loadEnvFile(path.dirname(fileURLToPath(import.meta.url)));
const e = resolveModeEnv(process.env);
const { NODE_ENV = 'development', DB_HOST = '', DB_PORT = '1433', DB_NAME = 'OIT' } = e;

// db pull 會讀取資料庫結構，同樣禁止在非 production 模式碰正式機（含網域名稱解析）
if (DB_HOST) await assertDbTargetAllowed(NODE_ENV, DB_HOST);

/** SQL Server 連線字串，值用 {} 包起來避免密碼含 ; = 等特殊字元 */
function sqlServerUrl(): string | undefined {
  if (!DB_HOST) return undefined;
  const v = (s = '') => `{${s.replace(/}/g, '}}')}}`;
  return [
    `sqlserver://${DB_HOST}:${DB_PORT}`,
    `database=${v(DB_NAME)}`,
    `user=${v(e.DB_USER)}`,
    `password=${v(e.DB_PASS)}`,
    `encrypt=${e.DB_ENCRYPT ?? 'true'}`,
    `trustServerCertificate=${e.DB_TRUST_SERVER_CERT ?? 'true'}`,
  ].join(';');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: sqlServerUrl() },
});

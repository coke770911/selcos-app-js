/**
 * 檢查 SQL Server 快取（[CACHE].[dbo].[tb_Session]）：npm run check:cache -w server
 * 跑與記憶體版相同的共用檢查，只寫入 selcos-app:check:* 的資料，結束時自行清除
 */
import { randomBytes } from 'node:crypto';
import { env } from '../src/config/env.js';
import { assertDbTargetAllowed } from '../src/config/dbGuard.js';
import { createSqlServerCache } from '../src/cache/sqlServerCache.js';
import { runCacheContract } from '../src/cache/contract.js';
import { disconnectPrisma, getPrisma } from '../src/db/prisma.js';

await assertDbTargetAllowed(env.NODE_ENV, env.DB_HOST);
console.log(`模式：${env.NODE_ENV}，連線：${env.DB_HOST}/[CACHE].[dbo].[tb_Session]`);

const cache = createSqlServerCache(getPrisma(), { cleanupIntervalMs: 3_600_000 });
try {
  const prefix = `check:${randomBytes(4).toString('hex')}:`;
  const results = await runCacheContract(
    cache,
    prefix,
    (ms) => new Promise((r) => setTimeout(r, ms)),
  );
  for (const r of results)
    console.log(`${r.ok ? '✔' : '✘'} ${r.name}${r.detail ? `  ${r.detail}` : ''}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `失敗 ${failed} 項` : '全部通過');
  if (failed) process.exitCode = 1;
} finally {
  cache.stop();
  await disconnectPrisma();
}

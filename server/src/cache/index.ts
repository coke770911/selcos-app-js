import { env } from '../config/env.js';
import { logger } from '../logger.js';
import { getPrisma } from '../db/prisma.js';
import type { CacheStore } from './CacheStore.js';
import { createMemoryCache } from './memoryCache.js';
import { createSqlServerCache } from './sqlServerCache.js';

export type { CacheStore } from './CacheStore.js';

/**
 * sqlserver：存在 [CACHE].[dbo].[tb_Session]，負載平衡下多台伺服器共用（預設）
 * memory：只存在本機程序，限單一伺服器、單一程序使用
 */
export function createCache(): CacheStore {
  switch (env.CACHE_DRIVER) {
    case 'sqlserver':
      return createSqlServerCache(getPrisma(), {
        onError: (err) => logger.warn({ err }, 'cache cleanup failed'),
      });
    case 'memory':
      return createMemoryCache();
    default:
      throw new Error(`CACHE_DRIVER=${env.CACHE_DRIVER} 尚未實作，請使用 sqlserver 或 memory`);
  }
}

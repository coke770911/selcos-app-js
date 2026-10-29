/** @import { CacheStore } from './CacheStore.js' */

/**
 * @typedef {object} Entry
 * @property {unknown} value
 * @property {number} expiresAt
 */

/**
 * 記憶體快取：PM2 重啟後資料會消失（所有人需重新登入）
 * @param {() => number} [now]
 * @returns {CacheStore & { stop(): void }}
 */
export function createMemoryCache(now = Date.now) {
  /** @type {Map<string, Entry>} */
  const store = new Map();

  /** @type {(key: string) => Entry | undefined} */
  const alive = (key) => {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) {
      store.delete(key);
      return undefined;
    }
    return entry;
  };

  // 定期清掉過期資料，避免沒人讀取的 key 一直佔記憶體
  const timer = setInterval(() => {
    const t = now();
    for (const [key, entry] of store) if (entry.expiresAt <= t) store.delete(key);
  }, 60_000);
  timer.unref();

  return {
    async get(key) {
      return /** @type {any} */ (alive(key)?.value);
    },
    async set(key, value, ttlSeconds) {
      store.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
    },
    async del(key) {
      store.delete(key);
    },
    async take(key) {
      const entry = alive(key);
      store.delete(key);
      return /** @type {any} */ (entry?.value);
    },
    async count(prefix) {
      let n = 0;
      for (const key of store.keys()) if (key.startsWith(prefix) && alive(key)) n++;
      return n;
    },
    stop() {
      clearInterval(timer);
    },
  };
}

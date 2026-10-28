import type { CacheStore } from './CacheStore.js';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/** 記憶體快取：PM2 重啟後資料會消失（所有人需重新登入） */
export function createMemoryCache(now: () => number = Date.now): CacheStore & { stop(): void } {
  const store = new Map<string, Entry>();

  const alive = (key: string): Entry | undefined => {
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
    async get<T>(key: string) {
      return alive(key)?.value as T | undefined;
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      store.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
    },
    async del(key: string) {
      store.delete(key);
    },
    async take<T>(key: string) {
      const entry = alive(key);
      store.delete(key);
      return entry?.value as T | undefined;
    },
    async count(prefix: string) {
      let n = 0;
      for (const key of store.keys()) if (key.startsWith(prefix) && alive(key)) n++;
      return n;
    },
    stop() {
      clearInterval(timer);
    },
  };
}

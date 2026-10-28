/**
 * 快取介面：目前用記憶體實作（單一 instance），
 * 之後改 PM2 cluster 時換成 Redis/Garnet 實作，呼叫端不用改。
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  /** 取出後立即刪除（一次性資料，例如驗證碼） */
  take<T>(key: string): Promise<T | undefined>;
  /** 符合前綴且未過期的 key 數量（線上人數用） */
  count(prefix: string): Promise<number>;
}

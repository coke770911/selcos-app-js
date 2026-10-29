/**
 * 快取介面：目前用記憶體實作（單一 instance），
 * 之後改 PM2 cluster 時換成 Redis/Garnet 實作，呼叫端不用改。
 * @typedef {object} CacheStore
 * @property {<T>(key: string) => Promise<T | undefined>} get
 * @property {<T>(key: string, value: T, ttlSeconds: number) => Promise<void>} set
 * @property {(key: string) => Promise<void>} del
 * @property {<T>(key: string) => Promise<T | undefined>} take 取出後立即刪除（一次性資料，例如驗證碼）
 * @property {(prefix: string) => Promise<number>} count 符合前綴且未過期的 key 數量（線上人數用）
 */

export {};

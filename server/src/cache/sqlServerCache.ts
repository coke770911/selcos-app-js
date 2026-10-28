import type { CacheStore } from './CacheStore.js';

/** 只需要 Prisma 的 raw query 能力，不綁定 PrismaClient 型別 */
export interface SqlRunner {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

/** 新系統資料的前綴，與舊系統的 PHP session 分開；清除時只動這個前綴 */
export const KEY_NAMESPACE = 'selcos-app:';
const MAX_KEY_LENGTH = 128; // php_sessID varchar(128)

/**
 * 以舊系統的 [CACHE].[dbo].[tb_Session] 當共用快取（負載平衡下多台伺服器共用）。
 * 不改表結構，欄位對應：
 *   php_sessID       = selcos-app: + key
 *   php_sessionValue = JSON
 *   php_login        = 建立時間（Unix 秒）
 *   php_time         = 到期時間（Unix 秒）
 *   php_stdno        = 'guest'，避免舊系統登入刪除同學號 session、線上人數統計誤算
 * 時間一律取資料庫伺服器的時間，避免多台伺服器時鐘不一致。
 */
export function createSqlServerCache(
  db: SqlRunner,
  options: { cleanupIntervalMs?: number; onError?: (err: unknown) => void } = {},
): CacheStore & { stop(): void; cleanup(): Promise<number> } {
  const id = (key: string) => {
    const full = `${KEY_NAMESPACE}${key}`;
    if (full.length > MAX_KEY_LENGTH)
      throw new Error(`cache key 超過 ${MAX_KEY_LENGTH} 字元：${full}`);
    return full;
  };

  async function read(key: string): Promise<string | undefined> {
    const rows = await db.$queryRaw<{ v: string }[]>`
      SELECT php_sessionValue AS v FROM [CACHE].[dbo].[tb_Session]
      WHERE php_sessID = ${id(key)}
        AND php_time > DATEDIFF_BIG(SECOND, '19700101', SYSUTCDATETIME())`;
    return rows[0]?.v;
  }

  const parse = <T>(v: string | undefined) => (v === undefined ? undefined : (JSON.parse(v) as T));

  async function cleanup(): Promise<number> {
    return db.$executeRaw`
      DELETE FROM [CACHE].[dbo].[tb_Session]
      WHERE php_sessID LIKE ${`${KEY_NAMESPACE}%`}
        AND php_time <= DATEDIFF_BIG(SECOND, '19700101', SYSUTCDATETIME())`;
  }

  const timer = setInterval(() => {
    cleanup().catch((err) => options.onError?.(err));
  }, options.cleanupIntervalMs ?? 60_000);
  timer.unref();

  return {
    async get<T>(key: string) {
      return parse<T>(await read(key));
    },

    async set<T>(key: string, value: T, ttlSeconds: number) {
      const json = JSON.stringify(value);
      await db.$executeRaw`
        MERGE [CACHE].[dbo].[tb_Session] WITH (HOLDLOCK) AS t
        USING (SELECT CAST(${id(key)} AS varchar(128)) AS sid,
                      DATEDIFF_BIG(SECOND, '19700101', SYSUTCDATETIME()) AS now_s) AS s
          ON t.php_sessID = s.sid
        WHEN MATCHED THEN
          UPDATE SET php_sessionValue = ${json}, php_login = s.now_s, php_time = s.now_s + ${ttlSeconds}
        WHEN NOT MATCHED THEN
          INSERT (php_sessID, php_time, php_sessionValue, php_login, php_stdno)
          VALUES (s.sid, s.now_s + ${ttlSeconds}, ${json}, s.now_s, 'guest');`;
    },

    async del(key: string) {
      await db.$executeRaw`DELETE FROM [CACHE].[dbo].[tb_Session] WHERE php_sessID = ${id(key)}`;
    },

    async take<T>(key: string) {
      // 刪除成功（影響 1 筆）才算取得，多台伺服器同時取只會有一台拿到
      const value = await read(key);
      const deleted = await db.$executeRaw`
        DELETE FROM [CACHE].[dbo].[tb_Session] WHERE php_sessID = ${id(key)}`;
      return deleted === 1 ? parse<T>(value) : undefined;
    },

    async count(prefix: string) {
      const pattern = `${id(prefix).replace(/[[\]%_]/g, '[$&]')}%`;
      const rows = await db.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*) AS n FROM [CACHE].[dbo].[tb_Session]
        WHERE php_sessID LIKE ${pattern}
          AND php_time > DATEDIFF_BIG(SECOND, '19700101', SYSUTCDATETIME())`;
      return Number(rows[0]?.n ?? 0);
    },

    stop() {
      clearInterval(timer);
    },

    cleanup,
  };
}

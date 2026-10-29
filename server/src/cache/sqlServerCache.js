/**
 * @import { SqlRunner } from '../db/sequelize.js'
 * @import { CacheStore } from './CacheStore.js'
 */

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
 * @param {SqlRunner} db
 * @param {{ cleanupIntervalMs?: number; onError?: (err: unknown) => void }} [options]
 * @returns {CacheStore & { stop(): void; cleanup(): Promise<number> }}
 */
export function createSqlServerCache(db, options = {}) {
  /** @param {string} key */
  const id = (key) => {
    const full = `${KEY_NAMESPACE}${key}`;
    if (full.length > MAX_KEY_LENGTH)
      throw new Error(`cache key 超過 ${MAX_KEY_LENGTH} 字元：${full}`);
    return full;
  };

  /**
   * @param {string} key
   * @returns {Promise<string | undefined>}
   */
  async function read(key) {
    /** @type {{ v: string }[]} */
    const rows = await db.select(
      `SELECT php_sessionValue AS v FROM [CACHE].[dbo].[tb_Session]
      WHERE php_sessID = $sid
        AND php_time > DATEDIFF_BIG(SECOND, '19700101', SYSUTCDATETIME())`,
      { sid: id(key) },
    );
    return rows[0]?.v;
  }

  /** @type {(v: string | undefined) => any} */
  const parse = (v) => (v === undefined ? undefined : JSON.parse(v));

  /** @returns {Promise<number>} */
  async function cleanup() {
    return db.execute(
      `DELETE FROM [CACHE].[dbo].[tb_Session]
      WHERE php_sessID LIKE $pattern
        AND php_time <= DATEDIFF_BIG(SECOND, '19700101', SYSUTCDATETIME())`,
      { pattern: `${KEY_NAMESPACE}%` },
    );
  }

  const timer = setInterval(() => {
    cleanup().catch((err) => options.onError?.(err));
  }, options.cleanupIntervalMs ?? 60_000);
  timer.unref();

  return {
    async get(key) {
      return parse(await read(key));
    },

    async set(key, value, ttlSeconds) {
      const json = JSON.stringify(value);
      await db.execute(
        `MERGE [CACHE].[dbo].[tb_Session] WITH (HOLDLOCK) AS t
        USING (SELECT CAST($sid AS varchar(128)) AS sid,
                      DATEDIFF_BIG(SECOND, '19700101', SYSUTCDATETIME()) AS now_s) AS s
          ON t.php_sessID = s.sid
        WHEN MATCHED THEN
          UPDATE SET php_sessionValue = $json, php_login = s.now_s, php_time = s.now_s + $ttl
        WHEN NOT MATCHED THEN
          INSERT (php_sessID, php_time, php_sessionValue, php_login, php_stdno)
          VALUES (s.sid, s.now_s + $ttl, $json, s.now_s, 'guest');`,
        { sid: id(key), json, ttl: ttlSeconds },
      );
    },

    async del(key) {
      await db.execute(`DELETE FROM [CACHE].[dbo].[tb_Session] WHERE php_sessID = $sid`, {
        sid: id(key),
      });
    },

    async take(key) {
      // 刪除成功（影響 1 筆）才算取得，多台伺服器同時取只會有一台拿到
      const value = await read(key);
      const deleted = await db.execute(
        `DELETE FROM [CACHE].[dbo].[tb_Session] WHERE php_sessID = $sid`,
        { sid: id(key) },
      );
      return deleted === 1 ? parse(value) : undefined;
    },

    async count(prefix) {
      const pattern = `${id(prefix).replace(/[[\]%_]/g, '[$&]')}%`;
      /** @type {{ n: number }[]} */
      const rows = await db.select(
        `SELECT COUNT(*) AS n FROM [CACHE].[dbo].[tb_Session]
        WHERE php_sessID LIKE $pattern
          AND php_time > DATEDIFF_BIG(SECOND, '19700101', SYSUTCDATETIME())`,
        { pattern },
      );
      return Number(rows[0]?.n ?? 0);
    },

    stop() {
      clearInterval(timer);
    },

    cleanup,
  };
}

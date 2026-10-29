import { randomUUID } from 'node:crypto';

/**
 * 單一登入：每個學號只記錄最新一張 JWT 的 jti（JWT ID）。
 * JWT 本身無法撤銷，靠比對 jti 讓舊 token 失效：
 *   - 新登入（含管理員代登）會取代舊的，對應舊系統「後登入踢掉前一個」
 *   - 登出後該 token 立即失效
 */
export const SESSION_PREFIX = 'session:';
/** @param {string} stdNo */
const key = (stdNo) => `${SESSION_PREFIX}${stdNo}`;

/**
 * @import { MeResponse } from '@selcos/shared'
 * @import { CacheStore } from '../cache/CacheStore.js'
 */

/**
 * @typedef {object} ActiveToken
 * @property {string} jti
 * @property {MeResponse} me 登入時算好的資料，/api/auth/me 直接回傳
 */

/**
 * active：有效；replaced：已被新的登入取代；expired：過期或已登出
 * @typedef {{ status: 'active'; me: MeResponse } | { status: 'replaced' } | { status: 'expired' }} SessionCheck
 */

/**
 * @typedef {object} SessionService
 * @property {(stdNo: string, me: MeResponse, ttlSeconds: number) => Promise<string>} start
 *   登記新的登入，回傳要放進 JWT 的 jti
 * @property {(stdNo: string, jti: string) => Promise<SessionCheck>} check
 *   檢查 jti 是否仍是該學號目前有效的 token
 * @property {(stdNo: string, jti: string) => Promise<void>} end
 * @property {() => Promise<number>} count 目前登入中的人數
 */

/**
 * @param {CacheStore} cache
 * @returns {SessionService}
 */
export function createSessionService(cache) {
  return {
    async start(stdNo, me, ttlSeconds) {
      const jti = randomUUID();
      await cache.set(key(stdNo), /** @type {ActiveToken} */ ({ jti, me }), ttlSeconds);
      return jti;
    },

    async check(stdNo, jti) {
      /** @type {ActiveToken | undefined} */
      const active = await cache.get(key(stdNo));
      if (!active) return { status: 'expired' };
      return active.jti === jti ? { status: 'active', me: active.me } : { status: 'replaced' };
    },

    async end(stdNo, jti) {
      /** @type {ActiveToken | undefined} */
      const active = await cache.get(key(stdNo));
      if (active?.jti === jti) await cache.del(key(stdNo));
    },

    count() {
      return cache.count(SESSION_PREFIX);
    },
  };
}

import { randomUUID } from 'node:crypto';
import type { MeResponse } from '@selcos/shared';
import type { CacheStore } from '../cache/CacheStore.js';

/**
 * 單一登入：每個學號只記錄最新一張 JWT 的 jti（JWT ID）。
 * JWT 本身無法撤銷，靠比對 jti 讓舊 token 失效：
 *   - 新登入（含管理員代登）會取代舊的，對應舊系統「後登入踢掉前一個」
 *   - 登出後該 token 立即失效
 */
export const SESSION_PREFIX = 'session:';
const key = (stdNo: string) => `${SESSION_PREFIX}${stdNo}`;

interface ActiveToken {
  jti: string;
  /** 登入時算好的資料，/api/auth/me 直接回傳 */
  me: MeResponse;
}

/** active：有效；replaced：已被新的登入取代；expired：過期或已登出 */
export type SessionCheck =
  { status: 'active'; me: MeResponse } | { status: 'replaced' } | { status: 'expired' };

export interface SessionService {
  /** 登記新的登入，回傳要放進 JWT 的 jti */
  start(stdNo: string, me: MeResponse, ttlSeconds: number): Promise<string>;
  /** 檢查 jti 是否仍是該學號目前有效的 token */
  check(stdNo: string, jti: string): Promise<SessionCheck>;
  end(stdNo: string, jti: string): Promise<void>;
  /** 目前登入中的人數 */
  count(): Promise<number>;
}

export function createSessionService(cache: CacheStore): SessionService {
  return {
    async start(stdNo, me, ttlSeconds) {
      const jti = randomUUID();
      await cache.set<ActiveToken>(key(stdNo), { jti, me }, ttlSeconds);
      return jti;
    },

    async check(stdNo, jti) {
      const active = await cache.get<ActiveToken>(key(stdNo));
      if (!active) return { status: 'expired' };
      return active.jti === jti ? { status: 'active', me: active.me } : { status: 'replaced' };
    },

    async end(stdNo, jti) {
      const active = await cache.get<ActiveToken>(key(stdNo));
      if (active?.jti === jti) await cache.del(key(stdNo));
    },

    count() {
      return cache.count(SESSION_PREFIX);
    },
  };
}

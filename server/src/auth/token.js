import jwt from 'jsonwebtoken';

/** @import { Role, SelcosMode } from '@selcos/shared' */

/**
 * JWT 只放身分與選課學期，其餘資料放快取
 * @typedef {object} SessionClaims
 * @property {string} sub 學號
 * @property {string} jti JWT ID，單一登入比對用
 * @property {Role} role
 * @property {string} [adminId]
 * @property {string} smtr
 * @property {SelcosMode} mode
 */

/**
 * @typedef {object} TokenService
 * @property {(claims: SessionClaims) => { token: string; expiresAt: Date }} sign
 * @property {(token: string) => SessionClaims | null} verify
 */

const ISSUER = 'selcos';

/**
 * @param {string} secret
 * @param {number} ttlSeconds
 * @returns {TokenService}
 */
export function createTokenService(secret, ttlSeconds) {
  return {
    sign(claims) {
      const token = jwt.sign(claims, secret, {
        algorithm: 'HS256',
        expiresIn: ttlSeconds,
        issuer: ISSUER,
      });
      return { token, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
    },

    verify(token) {
      try {
        const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ISSUER });
        if (typeof payload === 'string' || !payload.sub || !payload.jti) return null;
        return /** @type {SessionClaims} */ (/** @type {unknown} */ (payload));
      } catch {
        return null;
      }
    },
  };
}

import jwt from 'jsonwebtoken';
import type { Role, SelcosMode } from '@selcos/shared';

/** JWT 只放身分與選課學期，其餘資料放快取 */
export interface SessionClaims {
  sub: string; // 學號
  jti: string; // JWT ID，單一登入比對用
  role: Role;
  adminId?: string;
  smtr: string;
  mode: SelcosMode;
}

export interface TokenService {
  sign(claims: SessionClaims): { token: string; expiresAt: Date };
  verify(token: string): SessionClaims | null;
}

const ISSUER = 'selcos';

export function createTokenService(secret: string, ttlSeconds: number): TokenService {
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
        return payload as unknown as SessionClaims;
      } catch {
        return null;
      }
    },
  };
}

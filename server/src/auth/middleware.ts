import type { RequestHandler } from 'express';
import { ERROR_CODES, type MeResponse } from '@selcos/shared';
import { AppError } from '../errors.js';
import type { SessionClaims, TokenService } from './token.js';
import type { SessionService } from './session.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { claims: SessionClaims; me: MeResponse };
  }
}

/** 驗證 Bearer token，並確認仍是該學號目前的登入（單一登入） */
export function requireAuth(tokens: TokenService, sessions: SessionService): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const claims = token ? tokens.verify(token) : null;
    if (!claims) {
      return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, '請重新登入選課系統。'));
    }

    const result = await sessions.check(claims.sub, claims.jti);
    if (result.status === 'replaced') {
      return next(
        new AppError(
          401,
          ERROR_CODES.SESSION_REPLACED,
          '您的帳號已在其他地方登入，此視窗已登出。如果不是您本人操作，請盡快變更密碼。',
        ),
      );
    }
    if (result.status === 'expired') {
      return next(
        new AppError(
          401,
          ERROR_CODES.SESSION_EXPIRED,
          '網頁放置過久或已登出，請重新登入選課系統！',
        ),
      );
    }

    req.auth = { claims, me: result.me };
    next();
  };
}

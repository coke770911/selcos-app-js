import { ERROR_CODES } from '@selcos/shared';
import { AppError } from '../errors.js';

/**
 * @import { Request, RequestHandler } from 'express'
 * @import { TokenService } from './token.js'
 * @import { SessionService } from './session.js'
 */

/**
 * 驗證 Bearer token，並確認仍是該學號目前的登入（單一登入）；通過後設定 req.auth
 * @param {TokenService} tokens
 * @param {SessionService} sessions
 * @returns {RequestHandler}
 */
export function requireAuth(tokens, sessions) {
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

/**
 * 掛了 requireAuth 的路由取得登入資料（等同 TypeScript 的 req.auth!）
 * @param {Request} req
 */
export function authOf(req) {
  return /** @type {NonNullable<Request['auth']>} */ (req.auth);
}

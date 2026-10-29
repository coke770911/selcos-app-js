import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { ERROR_CODES } from '@selcos/shared';
import { authOf, requireAuth } from '../auth/middleware.js';
import { browserName } from '../auth/userAgent.js';

/**
 * @import { Request } from 'express'
 * @import { ApiError, LoginRequest } from '@selcos/shared'
 * @import { CaptchaService } from '../auth/captcha.js'
 * @import { SessionService } from '../auth/session.js'
 * @import { TokenService } from '../auth/token.js'
 * @import { AuthService } from '../services/authService.js'
 */

/** @satisfies {z.ZodType<LoginRequest>} */
const loginSchema = z.object({
  account: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
  captchaId: z.string().min(1).max(100),
  captcha: z.string().trim().min(1).max(10),
});

/** @param {Request} req */
const clientInfo = (req) => ({
  ip: req.ip ?? '',
  browser: browserName(req.get('user-agent')),
});

/**
 * @typedef {object} AuthRouterDeps
 * @property {AuthService} auth
 * @property {CaptchaService} captcha
 * @property {SessionService} sessions
 * @property {TokenService} tokens
 */

/** @param {AuthRouterDeps} deps */
export function authRouter(deps) {
  const router = Router();
  const authed = requireAuth(deps.tokens, deps.sessions);

  // 依帳號限制嘗試次數；校內多人共用 NAT 出口 IP，所以不以 IP 為單位
  const loginLimiter = rateLimit({
    windowMs: 5 * 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) =>
      String(req.body?.account ?? '')
        .trim()
        .toUpperCase()
        .split('/')[0] || 'empty',
    handler: (_req, res) => {
      /** @type {ApiError} */
      const body = {
        code: ERROR_CODES.TOO_MANY_REQUESTS,
        message: '登入嘗試次數過多，請 5 分鐘後再試。',
      };
      res.status(429).json(body);
    },
  });

  router.get('/captcha', async (_req, res) => {
    res.set('Cache-Control', 'no-store').json(await deps.captcha.create());
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const body = loginSchema.parse(req.body);
    res.json(await deps.auth.login(body, clientInfo(req)));
  });

  router.post('/logout', authed, async (req, res) => {
    await deps.auth.logout(authOf(req).claims, clientInfo(req));
    res.status(204).end();
  });

  router.get('/me', authed, (req, res) => {
    res.json(authOf(req).me);
  });

  // 選課畫面定期呼叫，確認登入仍有效（被其他登入取代時回 401 SESSION_REPLACED）
  router.get('/check', authed, (_req, res) => {
    res.set('Cache-Control', 'no-store').status(204).end();
  });

  return router;
}

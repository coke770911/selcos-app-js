import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { ERROR_CODES, type ApiError, type LoginRequest } from '@selcos/shared';
import { requireAuth } from '../auth/middleware.js';
import { browserName } from '../auth/userAgent.js';
import type { CaptchaService } from '../auth/captcha.js';
import type { SessionService } from '../auth/session.js';
import type { TokenService } from '../auth/token.js';
import type { AuthService } from '../services/authService.js';

const loginSchema = z.object({
  account: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
  captchaId: z.string().min(1).max(100),
  captcha: z.string().trim().min(1).max(10),
}) satisfies z.ZodType<LoginRequest>;

const clientInfo = (req: Request) => ({
  ip: req.ip ?? '',
  browser: browserName(req.get('user-agent')),
});

export interface AuthRouterDeps {
  auth: AuthService;
  captcha: CaptchaService;
  sessions: SessionService;
  tokens: TokenService;
}

export function authRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const authed = requireAuth(deps.tokens, deps.sessions);

  // 依帳號限制嘗試次數；校內多人共用 NAT 出口 IP，所以不以 IP 為單位
  const loginLimiter = rateLimit({
    windowMs: 5 * 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) =>
      String((req.body as { account?: unknown } | undefined)?.account ?? '')
        .trim()
        .toUpperCase()
        .split('/')[0] || 'empty',
    handler: (_req, res) => {
      const body: ApiError = {
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
    await deps.auth.logout(req.auth!.claims, clientInfo(req));
    res.status(204).end();
  });

  router.get('/me', authed, (req, res) => {
    res.json(req.auth!.me);
  });

  // 選課畫面定期呼叫，確認登入仍有效（被其他登入取代時回 401 SESSION_REPLACED）
  router.get('/check', authed, (_req, res) => {
    res.set('Cache-Control', 'no-store').status(204).end();
  });

  return router;
}

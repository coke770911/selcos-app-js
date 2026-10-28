import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import type { SessionService } from '../auth/session.js';
import type { TokenService } from '../auth/token.js';
import type { EnrollmentService } from '../services/enrollmentService.js';

const courseKey = z.object({
  cosId: z.string().trim().min(1).max(10),
  cosClass: z.string().trim().min(1).max(2),
  cosTerm: z.string().trim().length(1),
});

export function selectionRouter(deps: {
  enrollment: EnrollmentService;
  sessions: SessionService;
  tokens: TokenService;
}): Router {
  const router = Router();
  router.use(requireAuth(deps.tokens, deps.sessions));

  // 目前課表與學分
  router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await deps.enrollment.state(req.auth!.claims.sub));
  });

  // 加選，回傳最新課表
  router.post('/', async (req, res) => {
    res.json(await deps.enrollment.add(req.auth!.claims.sub, courseKey.parse(req.body)));
  });

  // 退選（條件放在網址，部分反向代理會丟掉 DELETE 的 body），回傳最新課表
  router.delete('/:cosId/:cosClass/:cosTerm', async (req, res) => {
    res.json(await deps.enrollment.drop(req.auth!.claims.sub, courseKey.parse(req.params)));
  });

  return router;
}

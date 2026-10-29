import { Router } from 'express';
import { z } from 'zod';
import { authOf, requireAuth } from '../auth/middleware.js';

const courseKey = z.object({
  cosId: z.string().trim().min(1).max(10),
  cosClass: z.string().trim().min(1).max(2),
  cosTerm: z.string().trim().length(1),
});

/**
 * @import { SessionService } from '../auth/session.js'
 * @import { TokenService } from '../auth/token.js'
 * @import { EnrollmentService } from '../services/enrollmentService.js'
 */

/** @param {{ enrollment: EnrollmentService; sessions: SessionService; tokens: TokenService }} deps */
export function selectionRouter(deps) {
  const router = Router();
  router.use(requireAuth(deps.tokens, deps.sessions));

  // 目前課表與學分
  router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await deps.enrollment.state(authOf(req).claims.sub));
  });

  // 加選，回傳最新課表
  router.post('/', async (req, res) => {
    res.json(await deps.enrollment.add(authOf(req).claims.sub, courseKey.parse(req.body)));
  });

  // 退選（條件放在網址，部分反向代理會丟掉 DELETE 的 body），回傳最新課表
  router.delete('/:cosId/:cosClass/:cosTerm', async (req, res) => {
    res.json(await deps.enrollment.drop(authOf(req).claims.sub, courseKey.parse(req.params)));
  });

  return router;
}

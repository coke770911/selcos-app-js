import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware.js';
import type { SessionService } from '../auth/session.js';
import type { TokenService } from '../auth/token.js';
import type { CourseService } from '../services/courseService.js';

const listQuery = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('dept'),
    deptNo: z.string().trim().min(1).max(10),
    year: z.string().trim().regex(/^\d$/),
  }),
  z.object({
    mode: z.literal('time'),
    weekday: z.string().regex(/^[1-7]$/),
    period: z.string().regex(/^(0[1-9]|1[0-5])$/),
  }),
]);

const infoParams = z.object({
  cosId: z.string().trim().min(1).max(10),
  cosClass: z.string().trim().min(1).max(2),
  cosTerm: z.string().trim().length(1),
});

export function coursesRouter(deps: {
  courses: CourseService;
  sessions: SessionService;
  tokens: TokenService;
}): Router {
  const router = Router();
  router.use(requireAuth(deps.tokens, deps.sessions));

  // 查詢選單：學制、本學期有開課的系所
  router.get('/filters', async (req, res) => {
    res.json(await deps.courses.filters(req.auth!.claims.sub));
  });

  // 課程清單：?mode=dept&deptNo&year 或 ?mode=time&weekday&period
  router.get('/', async (req, res) => {
    res.json(await deps.courses.list(req.auth!.claims.sub, listQuery.parse(req.query)));
  });

  // 課程資訊（學期取登入時的選課學期）
  router.get('/:cosId/:cosClass/:cosTerm', async (req, res) => {
    res.json(await deps.courses.info(req.auth!.claims.sub, infoParams.parse(req.params)));
  });

  return router;
}

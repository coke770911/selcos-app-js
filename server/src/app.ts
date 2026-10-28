import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { ERROR_CODES, type ApiError, type AppInfo, type HealthResponse } from '@selcos/shared';
import { env } from './config/env.js';
import { logger } from './logger.js';
import { AppError } from './errors.js';
import type { AppDeps } from './container.js';
import { authRouter } from './routes/auth.js';
import { serveWeb } from './web.js';

export interface AppOptions {
  /** 前端打包目錄；false 不提供前端（測試用） */
  webDir?: string | false;
}

export function createApp(deps: AppDeps, options: AppOptions = {}) {
  const app = express();

  // 部署在 IIS ARR 之後，取用 X-Forwarded-For 作為來源 IP
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      env: env.NODE_ENV,
      version: env.APP_VERSION,
      time: new Date().toISOString(),
    };
    res.json(body);
  });

  app.get('/api/public/app-info', (_req, res) => {
    const body: AppInfo = {
      title: '選課系統',
      titleSuffix: env.APP_TITLE_SUFFIX,
      version: env.APP_VERSION,
      env: env.NODE_ENV,
      sessionTtlSeconds: env.SESSION_TTL_SECONDS,
    };
    res.json(body);
  });

  // 開放時段公告（舊系統 index.php）
  app.get('/api/public/schedule', async (_req, res) => {
    res.json(await deps.publicRepo.findSchedule());
  });

  // 線上人數（舊系統 selcos_online.php）
  app.get('/api/public/online', async (_req, res) => {
    res.json({ count: await deps.sessions.count() });
  });

  app.use('/api/auth', authRouter(deps));

  app.use('/api', (_req, res) => {
    const body: ApiError = { code: ERROR_CODES.NOT_FOUND, message: '找不到此 API' };
    res.status(404).json(body);
  });

  if (options.webDir !== false) serveWeb(app, options.webDir);

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof AppError) {
      const body: ApiError = { code: err.code, message: err.message };
      res.status(err.status).json(body);
      return;
    }
    if (err instanceof ZodError || (err as { type?: string }).type === 'entity.parse.failed') {
      const body: ApiError = { code: ERROR_CODES.BAD_REQUEST, message: '輸入資料格式錯誤。' };
      res.status(400).json(body);
      return;
    }
    logger.error({ err, url: req.originalUrl }, 'unhandled error');
    const body: ApiError = { code: ERROR_CODES.INTERNAL, message: '系統發生錯誤，請稍後再試。' };
    res.status(500).json(body);
  };
  app.use(errorHandler);

  return app;
}

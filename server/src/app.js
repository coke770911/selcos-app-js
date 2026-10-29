import express from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { ERROR_CODES } from '@selcos/shared';
import { env } from './config/env.js';
import { APP_VERSION } from './config/version.js';
import { logger } from './logger.js';
import { AppError } from './errors.js';
import { authRouter } from './routes/auth.js';
import { coursesRouter } from './routes/courses.js';
import { selectionRouter } from './routes/selection.js';
import { serveWeb } from './web.js';

/**
 * @import { ErrorRequestHandler } from 'express'
 * @import { ApiError, AppInfo, HealthResponse } from '@selcos/shared'
 * @import { AppDeps } from './container.js'
 */

/**
 * @typedef {object} AppOptions
 * @property {string | false} [webDir] 前端打包目錄；false 不提供前端（測試用）
 */

/**
 * @param {AppDeps} deps
 * @param {AppOptions} [options]
 */
export function createApp(deps, options = {}) {
  const app = express();

  // 部署在 IIS ARR 之後，取用 X-Forwarded-For 作為來源 IP
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    /** @type {HealthResponse} */
    const body = {
      status: 'ok',
      env: env.NODE_ENV,
      version: APP_VERSION,
      time: new Date().toISOString(),
    };
    res.json(body);
  });

  app.get('/api/public/app-info', (_req, res) => {
    /** @type {AppInfo} */
    const body = {
      title: '選課系統',
      titleSuffix: env.APP_TITLE_SUFFIX,
      version: APP_VERSION,
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
  app.use('/api/courses', coursesRouter(deps));
  app.use('/api/selection', selectionRouter(deps));

  app.use('/api', (_req, res) => {
    /** @type {ApiError} */
    const body = { code: ERROR_CODES.NOT_FOUND, message: '找不到此 API' };
    res.status(404).json(body);
  });

  if (options.webDir !== false) serveWeb(app, options.webDir);

  /** @type {ErrorRequestHandler} */
  const errorHandler = (err, req, res, _next) => {
    if (err instanceof AppError) {
      /** @type {ApiError} */
      const body = { code: err.code, message: err.message };
      res.status(err.status).json(body);
      return;
    }
    if (err instanceof ZodError || err.type === 'entity.parse.failed') {
      /** @type {ApiError} */
      const body = { code: ERROR_CODES.BAD_REQUEST, message: '輸入資料格式錯誤。' };
      res.status(400).json(body);
      return;
    }
    logger.error({ err, url: req.originalUrl }, 'unhandled error');
    /** @type {ApiError} */
    const body = { code: ERROR_CODES.INTERNAL, message: '系統發生錯誤，請稍後再試。' };
    res.status(500).json(body);
  };
  app.use(errorHandler);

  return app;
}

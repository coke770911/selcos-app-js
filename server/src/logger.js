import { pino } from 'pino';
import { env, isProduction } from './config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  // 正式模式輸出 JSON 給 PM2 收；測試模式用 pino-pretty 方便閱讀
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } },
  redact: ['req.headers.authorization', 'password', '*.password'],
});

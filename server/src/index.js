import { env, envFileLoaded } from './config/env.js';
import { assertDbTargetAllowed } from './config/dbGuard.js';
import { logger } from './logger.js';
import { createApp } from './app.js';
import { createDeps } from './container.js';

// 啟動前解析 DB 主機，避免用網域名稱繞過正式機防呆
await assertDbTargetAllowed(env.NODE_ENV, env.DB_HOST);

const app = createApp(createDeps());

app.listen(env.PORT, () => {
  logger.info(
    { env: env.NODE_ENV, envFile: envFileLoaded, db: `${env.DB_HOST}/${env.DB_NAME}` },
    `選課系統 API 啟動於 http://localhost:${env.PORT}`,
  );
});

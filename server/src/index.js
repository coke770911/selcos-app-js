import { env, envFileLoaded } from './config/env.js';
import { assertDbTargetAllowed } from './config/dbGuard.js';
import { logger } from './logger.js';
import { createApp } from './app.js';
import { createDeps } from './container.js';
import { closeSequelize } from './db/sequelize.js';

// 啟動前解析 DB 主機，避免用網域名稱繞過正式機防呆
await assertDbTargetAllowed(env.NODE_ENV, env.DB_HOST);

const app = createApp(createDeps());

const server = app.listen(env.PORT, () => {
  logger.info(
    { env: env.NODE_ENV, envFile: envFileLoaded, db: `${env.DB_HOST}/${env.DB_NAME}` },
    `選課系統 API 啟動於 http://localhost:${env.PORT}`,
  );
});

let closing = false;

/** 停止接新請求，等進行中的請求（例如加退選交易）完成後關閉連線池再結束 */
function shutdown() {
  if (closing) return;
  closing = true;
  logger.info('收到結束通知，等待進行中的請求完成');
  server.close(() => {
    closeSequelize()
      .catch((err) => logger.warn({ err }, 'close sequelize failed'))
      .finally(() => process.exit(0));
  });
}

// PM2 在 Windows 以訊息 'shutdown' 通知（shutdown_with_message），其他平台送 SIGINT／SIGTERM
process.on('message', (msg) => {
  if (msg === 'shutdown') shutdown();
});
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

/** @import { Express } from 'express' */

/** 前端打包輸出位置（web 的 vite build 會輸出到 server/public） */
export const DEFAULT_WEB_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../public',
);

/**
 * 由 Express 提供前端畫面，正式環境只需要一個 port。
 * 沒有打包結果時（開發時用 Vite）不掛載，回傳 false。
 * @param {Express} app
 * @param {string} [dir]
 * @returns {boolean}
 */
export function serveWeb(app, dir = DEFAULT_WEB_DIR) {
  const indexHtml = path.join(dir, 'index.html');
  if (!existsSync(indexHtml)) return false;

  // 檔名含 hash 的資源可長期快取；index.html 每次都要重新檢查
  app.use('/assets', express.static(path.join(dir, 'assets'), { immutable: true, maxAge: '365d' }));
  app.use(express.static(dir, { index: false, maxAge: 0 }));

  // Vue Router 的頁面（/login、/selection…）一律回傳 index.html
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache').sendFile(indexHtml);
  });
  return true;
}

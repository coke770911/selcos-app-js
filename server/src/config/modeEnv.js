/**
 * 同一個 .env 放正式與測試兩組參數（沿用舊系統 env.php 的做法）：
 *   正式模式（NODE_ENV=production）讀 DB_HOST…
 *   其他模式讀 TEST_DB_HOST…，不會退回使用正式參數
 */
export const MODE_KEYS = /** @type {const} */ ([
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASS',
  'DB_ENCRYPT',
  'DB_TRUST_SERVER_CERT',
  'ADMIN_ACCOUNTS',
]);

/** @typedef {(typeof MODE_KEYS)[number]} ModeKey */

const TEST_PREFIX = 'TEST_';

/** @param {string | undefined} nodeEnv */
export function isProductionMode(nodeEnv) {
  return nodeEnv === 'production';
}

/**
 * 依模式取得實際讀取的參數名稱，例如測試模式的 DB_HOST → TEST_DB_HOST
 * @param {string} key
 * @param {string | undefined} nodeEnv
 * @returns {string}
 */
export function sourceKey(key, nodeEnv) {
  const isModeKey = /** @type {readonly string[]} */ (MODE_KEYS).includes(key);
  return isModeKey && !isProductionMode(nodeEnv) ? `${TEST_PREFIX}${key}` : key;
}

/**
 * 回傳依模式選好參數的環境變數副本（不修改 process.env）
 * @param {NodeJS.ProcessEnv} src
 * @returns {NodeJS.ProcessEnv}
 */
export function resolveModeEnv(src) {
  /** @type {NodeJS.ProcessEnv} */
  const out = { ...src };
  for (const key of MODE_KEYS) {
    out[key] = src[sourceKey(key, src.NODE_ENV)];
  }
  return out;
}

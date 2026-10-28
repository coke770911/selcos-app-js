/**
 * 同一個 .env 放正式與測試兩組參數（沿用舊系統 env.php 的做法）：
 *   正式模式（NODE_ENV=production）讀 DB_HOST…
 *   其他模式讀 TEST_DB_HOST…，不會退回使用正式參數
 */
export const MODE_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASS',
  'DB_ENCRYPT',
  'DB_TRUST_SERVER_CERT',
  'ADMIN_ACCOUNTS',
] as const;

export type ModeKey = (typeof MODE_KEYS)[number];

const TEST_PREFIX = 'TEST_';

export function isProductionMode(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

/** 依模式取得實際讀取的參數名稱，例如測試模式的 DB_HOST → TEST_DB_HOST */
export function sourceKey(key: string, nodeEnv: string | undefined): string {
  const isModeKey = (MODE_KEYS as readonly string[]).includes(key);
  return isModeKey && !isProductionMode(nodeEnv) ? `${TEST_PREFIX}${key}` : key;
}

/** 回傳依模式選好參數的環境變數副本（不修改 process.env） */
export function resolveModeEnv(src: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...src };
  for (const key of MODE_KEYS) {
    out[key] = src[sourceKey(key, src.NODE_ENV)];
  }
  return out;
}

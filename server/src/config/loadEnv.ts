import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

/**
 * 載入 server/.env（每台機器一個檔案，用 NODE_ENV 決定測試／正式模式）。
 * 已存在於 process.env 的值不會被覆寫；未設定 NODE_ENV 時預設 development。
 * 回傳是否有讀到檔案。
 */
export function loadEnvFile(dir: string): boolean {
  const file = path.join(dir, '.env');
  const found = existsSync(file);
  if (found) {
    const parsed = parseEnv(readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
  process.env.NODE_ENV ??= 'development';
  return found;
}

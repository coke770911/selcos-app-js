import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 系統版本號：唯一來源為根目錄 package.json（src 與編譯後的 dist 都在專案下第三層）。
 * 每次 commit 以 npm run version:bump 將修訂號 +1。
 */
function readVersion(): string {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const APP_VERSION = readVersion();

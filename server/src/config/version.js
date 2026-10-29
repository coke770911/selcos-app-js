import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 系統版本號：唯一來源為根目錄 package.json（server/src/config 在專案下第三層）。
 * 每次 commit 以 npm run version:bump 將修訂號 +1。
 * @returns {string}
 */
function readVersion() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  try {
    /** @type {{ version?: string }} */
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const APP_VERSION = readVersion();

/**
 * AD 驗證檢查：npm run check:ldap -w server -- 帳號
 * 密碼從鍵盤輸入，不經過命令列參數
 */
import { createInterface } from 'node:readline/promises';
import { Client } from 'ldapts';
import { env } from '../src/config/env.js';

const account = process.argv[2];
if (!account) {
  console.error('用法：npm run check:ldap -w server -- 帳號');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('密碼：');
rl.close();

const client = new Client({ url: env.LDAP_URL, timeout: 5000, connectTimeout: 5000 });
try {
  await client.bind(`${account}@${env.LDAP_DOMAIN}`, password);
  console.log('AD 驗證成功');
} catch (err) {
  console.error('AD 驗證失敗：', (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.unbind();
}

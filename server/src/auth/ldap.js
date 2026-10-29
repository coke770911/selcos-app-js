import { Client } from 'ldapts';
import { env } from '../config/env.js';
import { logger } from '../logger.js';

/** @typedef {(account: string, password: string) => Promise<boolean>} LdapAuthenticate */

/**
 * AD 驗證（舊系統 login_check）：以 帳號@網域 bind，成功即通過
 * @type {LdapAuthenticate}
 */
export const ldapAuthenticate = async (account, password) => {
  // 空密碼會變成匿名 bind 而「成功」，必須先擋掉
  if (!account || !password) return false;

  const client = new Client({ url: env.LDAP_URL, timeout: 5000, connectTimeout: 5000 });
  try {
    await client.bind(`${account}@${env.LDAP_DOMAIN}`, password);
    return true;
  } catch (err) {
    const name = /** @type {Error} */ (err).name;
    // 帳密錯誤是正常情況；其他錯誤（連不到 AD 等）記錄下來
    if (name !== 'InvalidCredentialsError') logger.warn({ err, account }, 'LDAP bind error');
    return false;
  } finally {
    await client.unbind().catch(() => undefined);
  }
};

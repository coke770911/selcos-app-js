import { describe, expect, it } from 'vitest';
import { fitLoginLog, normalizeIp } from '../src/db/repositories/authRepository.js';
import { browserName } from '../src/auth/userAgent.js';

describe('登入紀錄欄位長度（cos_std_loginoutlog）', () => {
  it('IPv4 映射位址轉回 IPv4', () => {
    expect(normalizeIp('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeIp('::ffff:120.96.34.83')).toBe('120.96.34.83');
    expect(normalizeIp('::1')).toBe('::1');
  });

  it('超過欄位長度的值會被截斷', () => {
    const v = fitLoginLog({
      smtr: '11421',
      stdNo: '12345678901',
      type: 'i',
      ip: '2001:db8:85a3::8a2e:370:7334',
      browser: browserName('x'.repeat(100)),
      admin: 'b'.repeat(30),
    });
    expect(v.smtr).toHaveLength(4);
    expect(v.stdNo).toHaveLength(10);
    expect(v.ip.length).toBeLessThanOrEqual(15);
    expect(v.browser.length).toBeLessThanOrEqual(30);
    expect(v.admin).toHaveLength(20);
  });
});

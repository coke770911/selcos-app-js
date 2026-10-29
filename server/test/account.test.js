import { describe, expect, it } from 'vitest';
import { parseLoginAccount } from '../src/auth/account.js';

const admins = ['fz083', 'ot088'];

describe('parseLoginAccount', () => {
  it('學生本人登入：學號轉大寫，以學號做 AD 驗證', () => {
    expect(parseLoginAccount(' 112a0001 ', admins)).toEqual({
      stdNo: '112A0001',
      ldapAccount: '112A0001',
    });
  });

  it('管理員代登：以管理員帳號做 AD 驗證（不分大小寫）', () => {
    expect(parseLoginAccount('112a0001/FZ083', admins)).toEqual({
      stdNo: '112A0001',
      adminId: 'fz083',
      ldapAccount: 'fz083',
    });
  });

  it('不在名單內的管理員、空白或多個斜線一律拒絕', () => {
    expect(parseLoginAccount('112A0001/someone', admins)).toBeNull();
    expect(parseLoginAccount('112A0001/', admins)).toBeNull();
    expect(parseLoginAccount('/fz083', admins)).toBeNull();
    expect(parseLoginAccount('a/b/c', admins)).toBeNull();
    expect(parseLoginAccount('   ', admins)).toBeNull();
  });
});

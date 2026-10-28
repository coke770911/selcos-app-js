export interface ParsedAccount {
  /** 要登入選課的學號（大寫） */
  stdNo: string;
  /** 管理員代登時用來做 AD 驗證的管理員帳號；一般登入為 undefined */
  adminId?: string;
  /** 實際送去 AD 驗證的帳號 */
  ldapAccount: string;
}

/**
 * 解析登入帳號（沿用舊系統 process.php）：
 *   「學號」            → 學生本人登入
 *   「學號/管理員帳號」  → 管理員代登，以管理員帳密做 AD 驗證
 * 格式不符或管理員不在名單內時回傳 null。
 */
export function parseLoginAccount(input: string, adminAccounts: string[]): ParsedAccount | null {
  const parts = input.trim().toUpperCase().split('/');
  const stdNo = parts[0]?.trim() ?? '';
  if (!stdNo || parts.length > 2) return null;

  if (parts.length === 1) return { stdNo, ldapAccount: stdNo };

  const adminId = parts[1]?.trim().toLowerCase() ?? '';
  if (!adminId || !adminAccounts.includes(adminId)) return null;
  return { stdNo, adminId, ldapAccount: adminId };
}

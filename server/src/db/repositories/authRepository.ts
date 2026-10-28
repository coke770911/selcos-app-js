import { getPrisma } from '../prisma.js';

/** 在學學生基本資料（舊系統 process.php 的學籍查詢） */
export interface StudentRow {
  std_no: string;
  chi_name: string;
  type_no: string;
  /** 資料庫為字串，使用時轉數字 */
  degree: string;
  class: string;
  state: string;
  /** 1 轉系生、2 轉學生，其餘沿用 dat_std_basic.std_type */
  std_type: string;
  team: string;
  dept_no: string;
  entry_year: string;
  Academic_year: string;
  dept_name_s: string;
  grad_year: string;
}

/** 選課時段設定（v_selcostime_setting），階段 2 會用到更多欄位 */
export interface SelcosSettingRow {
  /** '1' 預選、'2' 加退選、'3' 暑期加退選 */
  sss_type: string;
  sss_smtr: string;
  sss_state: boolean;
  sss_beginTime: Date;
  sss_endTime: Date;
  [column: string]: unknown;
}

export interface LoginLog {
  smtr: string;
  stdNo: string;
  /** i 登入、f 登出 */
  type: 'i' | 'f';
  ip: string;
  browser: string;
  /** user 或管理員帳號 */
  admin: string;
}

export interface AuthRepository {
  findStudent(stdNo: string): Promise<StudentRow | null>;
  /** 一般學生只取目前開放中的時段；管理員不受時段限制 */
  findSetting(ignoreSchedule: boolean): Promise<SelcosSettingRow | null>;
  insertLoginLog(log: LoginLog): Promise<void>;
}

export const authRepository: AuthRepository = {
  async findStudent(stdNo) {
    // 20200911 轉系生 dat_std_turn_s → 1；轉學生 dat_std_turn（apply=Y, cancel=N）→ 2
    const rows = await getPrisma().$queryRaw<StudentRow[]>`
      SELECT a.std_no, a.chi_name, a.type_no, a.degree, a.class, a.[state],
        CASE
          WHEN (SELECT COUNT(std_no) FROM [OIT].[dbo].[dat_std_turn_s] WHERE std_no = a.std_no) > 0 THEN '1'
          WHEN (SELECT COUNT(std_no) FROM [OIT].[dbo].[dat_std_turn]
                WHERE std_no = a.std_no AND apply = 'Y' AND cancel = 'N') > 0 THEN '2'
          ELSE CAST(a.std_type AS varchar(10))
        END AS std_type,
        a.team, a.dept_no, a.entry_year, a.Academic_year, rp.dept_name_s, rp.grad_year
      FROM [OIT].[dbo].[dat_std_basic] AS a
      INNER JOIN [OIT].[dbo].[ref_dept] AS rp ON a.dept_no = rp.dept_no
      WHERE a.std_no = ${stdNo} AND a.[state] IN ('01', '06')`;
    return rows[0] ?? null;
  },

  async findSetting(ignoreSchedule) {
    const prisma = getPrisma();
    const active = await prisma.$queryRaw<SelcosSettingRow[]>`
      SELECT TOP 1 * FROM [OIT].[dbo].[v_selcostime_setting]
      WHERE sss_state = 1 AND GETDATE() BETWEEN sss_beginTime AND sss_endTime
      ORDER BY sss_beginTime DESC`;
    if (active[0] || !ignoreSchedule) return active[0] ?? null;

    // 管理員測試流程：沒有開放中的時段時，取最近一筆設定
    const latest = await prisma.$queryRaw<SelcosSettingRow[]>`
      SELECT TOP 1 * FROM [OIT].[dbo].[v_selcostime_setting] ORDER BY sss_beginTime DESC`;
    return latest[0] ?? null;
  },

  async insertLoginLog(log) {
    const v = fitLoginLog(log);
    // log_session_id 是舊版 PHP session 用的欄位，新系統改用 JWT，不再寫入（欄位允許 NULL）
    await getPrisma().$executeRaw`
      INSERT INTO [OIT].[dbo].[cos_std_loginoutlog]
        (log_smtr, log_std_no, log_type, log_ip_addr, log_browser, log_admin)
      VALUES (${v.smtr}, ${v.stdNo}, ${v.type}, ${v.ip}, ${v.browser}, ${v.admin})`;
  },
};

/** cos_std_loginoutlog 各欄位長度（正式機表結構不可改，寫入前由程式配合） */
const LOGIN_LOG_LIMITS = {
  smtr: 4,
  stdNo: 10,
  ip: 15,
  browser: 30,
  admin: 20,
} as const;

/** IPv4 映射位址（::ffff:1.2.3.4）轉回 IPv4，才放得進 char(15) */
export function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

/** 依欄位長度截斷，避免「String or binary data would be truncated」導致登入失敗 */
export function fitLoginLog(log: LoginLog): LoginLog {
  const fit = (s: string, n: number) => s.slice(0, n);
  return {
    ...log,
    smtr: fit(log.smtr, LOGIN_LOG_LIMITS.smtr),
    stdNo: fit(log.stdNo, LOGIN_LOG_LIMITS.stdNo),
    ip: fit(normalizeIp(log.ip), LOGIN_LOG_LIMITS.ip),
    browser: fit(log.browser, LOGIN_LOG_LIMITS.browser),
    admin: fit(log.admin, LOGIN_LOG_LIMITS.admin),
  };
}

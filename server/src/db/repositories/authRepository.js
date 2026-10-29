import { getDb } from '../sequelize.js';

/**
 * 在學學生基本資料（舊系統 process.php 的學籍查詢）
 * @typedef {object} StudentRow
 * @property {string} std_no
 * @property {string} chi_name
 * @property {string} type_no
 * @property {string} degree 資料庫為字串，使用時轉數字
 * @property {string} class
 * @property {string} state
 * @property {string} std_type 1 轉系生、2 轉學生，其餘沿用 dat_std_basic.std_type
 * @property {string} team
 * @property {string} dept_no
 * @property {string} entry_year
 * @property {string} Academic_year
 * @property {string} dept_name_s
 * @property {string} grad_year
 */

/**
 * 選課時段設定（v_selcostime_setting），其餘欄位依需要取用
 * @typedef {{
 *   sss_type: string;
 *   sss_smtr: string;
 *   sss_state: boolean;
 *   sss_beginTime: Date;
 *   sss_endTime: Date;
 *   [column: string]: unknown;
 * }} SelcosSettingRow
 * sss_type：'1' 預選、'2' 加退選、'3' 暑期加退選
 */

/**
 * @typedef {object} LoginLog
 * @property {string} smtr
 * @property {string} stdNo
 * @property {'i' | 'f'} type i 登入、f 登出
 * @property {string} ip
 * @property {string} browser
 * @property {string} admin user 或管理員帳號
 */

/**
 * @typedef {object} AuthRepository
 * @property {(stdNo: string) => Promise<StudentRow | null>} findStudent
 * @property {(ignoreSchedule: boolean) => Promise<SelcosSettingRow | null>} findSetting
 *   一般學生只取目前開放中的時段；管理員不受時段限制
 * @property {(log: LoginLog) => Promise<void>} insertLoginLog
 */

/** @type {AuthRepository} */
export const authRepository = {
  async findStudent(stdNo) {
    // 20200911 轉系生 dat_std_turn_s → 1；轉學生 dat_std_turn（apply=Y, cancel=N）→ 2
    const rows = await getDb().select(
      `SELECT a.std_no, a.chi_name, a.type_no, a.degree, a.class, a.[state],
        CASE
          WHEN (SELECT COUNT(std_no) FROM [OIT].[dbo].[dat_std_turn_s] WHERE std_no = a.std_no) > 0 THEN '1'
          WHEN (SELECT COUNT(std_no) FROM [OIT].[dbo].[dat_std_turn]
                WHERE std_no = a.std_no AND apply = 'Y' AND cancel = 'N') > 0 THEN '2'
          ELSE CAST(a.std_type AS varchar(10))
        END AS std_type,
        a.team, a.dept_no, a.entry_year, a.Academic_year, rp.dept_name_s, rp.grad_year
      FROM [OIT].[dbo].[dat_std_basic] AS a
      INNER JOIN [OIT].[dbo].[ref_dept] AS rp ON a.dept_no = rp.dept_no
      WHERE a.std_no = $stdNo AND a.[state] IN ('01', '06')`,
      { stdNo },
    );
    return /** @type {StudentRow | undefined} */ (rows[0]) ?? null;
  },

  async findSetting(ignoreSchedule) {
    const db = getDb();
    /** @type {SelcosSettingRow[]} */
    const active = await db.select(
      `SELECT TOP 1 * FROM [OIT].[dbo].[v_selcostime_setting]
      WHERE sss_state = 1 AND GETDATE() BETWEEN sss_beginTime AND sss_endTime
      ORDER BY sss_beginTime DESC`,
    );
    if (active[0] || !ignoreSchedule) return active[0] ?? null;

    // 管理員測試流程：沒有開放中的時段時，取最近一筆設定
    /** @type {SelcosSettingRow[]} */
    const latest = await db.select(
      `SELECT TOP 1 * FROM [OIT].[dbo].[v_selcostime_setting] ORDER BY sss_beginTime DESC`,
    );
    return latest[0] ?? null;
  },

  async insertLoginLog(log) {
    const v = fitLoginLog(log);
    // log_session_id 是舊版 PHP session 用的欄位，新系統改用 JWT，不再寫入（欄位允許 NULL）
    await getDb().execute(
      `INSERT INTO [OIT].[dbo].[cos_std_loginoutlog]
        (log_smtr, log_std_no, log_type, log_ip_addr, log_browser, log_admin)
      VALUES ($smtr, $stdNo, $type, $ip, $browser, $admin)`,
      { ...v },
    );
  },
};

/** cos_std_loginoutlog 各欄位長度（正式機表結構不可改，寫入前由程式配合） */
const LOGIN_LOG_LIMITS = /** @type {const} */ ({
  smtr: 4,
  stdNo: 10,
  ip: 15,
  browser: 30,
  admin: 20,
});

/**
 * IPv4 映射位址（::ffff:1.2.3.4）轉回 IPv4，才放得進 char(15)
 * @param {string} ip
 * @returns {string}
 */
export function normalizeIp(ip) {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

/**
 * 依欄位長度截斷，避免「String or binary data would be truncated」導致登入失敗
 * @param {LoginLog} log
 * @returns {LoginLog}
 */
export function fitLoginLog(log) {
  /** @type {(s: string, n: number) => string} */
  const fit = (s, n) => s.slice(0, n);
  return {
    ...log,
    smtr: fit(log.smtr, LOGIN_LOG_LIMITS.smtr),
    stdNo: fit(log.stdNo, LOGIN_LOG_LIMITS.stdNo),
    ip: fit(normalizeIp(log.ip), LOGIN_LOG_LIMITS.ip),
    browser: fit(log.browser, LOGIN_LOG_LIMITS.browser),
    admin: fit(log.admin, LOGIN_LOG_LIMITS.admin),
  };
}

/**
 * 測試機資料庫連線檢查（只做 SELECT）
 *   npm run check:db -w server              → 連線資訊與選課時段設定
 *   npm run check:db -w server -- 學號       → 另外查該學號學籍
 *   npm run check:db -w server -- --no-db   → 不指定資料庫（用帳號預設資料庫），排查登入問題
 */
import sql from 'mssql';
import { env } from '../src/config/env.js';
import { assertDbTargetAllowed } from '../src/config/dbGuard.js';
import { buildMssqlConfig } from '../src/db/mssqlConfig.js';

const args = process.argv.slice(2);
const noDb = args.includes('--no-db');
const stdNo = args.find((a) => !a.startsWith('--'));

await assertDbTargetAllowed(env.NODE_ENV, env.DB_HOST);

const config = buildMssqlConfig(env);
if (noDb) delete config.database;
console.log(
  `模式：${env.NODE_ENV}，連線：${env.DB_HOST}:${env.DB_PORT}/${config.database ?? '（帳號預設資料庫）'}`,
);

/** 印出 SQL Server 回傳的所有錯誤代碼，登入失敗時常有多筆 */
function printError(err: unknown) {
  const e = err as {
    code?: string;
    message?: string;
    originalError?: { message?: string; number?: number; state?: number; errors?: unknown[] };
  };
  console.error('連線失敗：', e.code, e.message);
  const orig = e.originalError;
  if (orig) console.error('  SQL 錯誤：', { number: orig.number, state: orig.state });
  for (const sub of orig?.errors ?? []) {
    const s = sub as { message?: string; number?: number; state?: number };
    console.error('  -', s.number, s.message);
  }
}

let pool: sql.ConnectionPool;
try {
  pool = await new sql.ConnectionPool(config).connect();
} catch (err) {
  printError(err);
  process.exit(1);
}

try {
  const info = await pool
    .request()
    .query('SELECT @@SERVERNAME AS server_name, DB_NAME() AS db_name, SYSTEM_USER AS login_name');
  console.log('連線成功：', info.recordset[0]);

  const setting = await pool
    .request()
    .query(
      'SELECT TOP 1 sss_smtr, sss_type, sss_state, sss_beginTime, sss_endTime FROM [OIT].[dbo].[v_selcostime_setting]',
    );
  console.log('選課時段設定：', setting.recordset[0] ?? '（無資料）');

  if (stdNo) {
    const std = await pool
      .request()
      .input('std_no', sql.VarChar, stdNo)
      .query(
        `SELECT a.std_no, a.chi_name, a.type_no, a.degree, a.class, a.[state], a.dept_no, rp.dept_name_s
         FROM [OIT].[dbo].[dat_std_basic] AS a
         INNER JOIN [OIT].[dbo].[ref_dept] AS rp ON a.dept_no = rp.dept_no
         WHERE a.std_no = @std_no`,
      );
    console.log('學籍：', std.recordset[0] ?? '（查無此學號）');
  }
} finally {
  await pool.close();
}

/**
 * 測試機資料庫連線檢查（只做 SELECT）
 *   npm run check:db -w server              → 連線資訊與選課時段設定
 *   npm run check:db -w server -- 學號       → 另外查該學號學籍
 *   npm run check:db -w server -- --no-db   → 不指定資料庫（用帳號預設資料庫），排查登入問題
 */
import { Sequelize } from 'sequelize';
import { env } from '../src/config/env.js';
import { assertDbTargetAllowed } from '../src/config/dbGuard.js';
import { buildSequelizeOptions } from '../src/db/connectionConfig.js';
import { createSqlRunner } from '../src/db/sequelize.js';

const args = process.argv.slice(2);
const noDb = args.includes('--no-db');
const stdNo = args.find((a) => !a.startsWith('--'));

await assertDbTargetAllowed(env.NODE_ENV, env.DB_HOST);

const options = buildSequelizeOptions(env);
if (noDb) delete options.database;
console.log(
  `模式：${env.NODE_ENV}，連線：${env.DB_HOST}:${env.DB_PORT}/${options.database ?? '（帳號預設資料庫）'}`,
);

/**
 * 印出 SQL Server 回傳的所有錯誤代碼，登入失敗時常有多筆
 * （Sequelize 的錯誤包著 tedious 原始錯誤 parent；多個 IP 都連不上時 parent 為 AggregateError）
 * @param {unknown} err
 */
function printError(err) {
  /** @typedef {{ code?: string; message?: string; number?: number; state?: number; errors?: unknown[] }} DriverError */
  const e = /** @type {{ name?: string; message?: string; parent?: DriverError }} */ (err);
  console.error('連線失敗：', e.name, e.message);
  const orig = e.parent;
  if (orig)
    console.error('  SQL 錯誤：', { code: orig.code, number: orig.number, state: orig.state });
  for (const sub of orig?.errors ?? []) {
    const s = /** @type {DriverError} */ (sub);
    console.error('  -', s.code ?? s.number, s.message);
  }
}

const sequelize = new Sequelize(options);
try {
  await sequelize.authenticate();
} catch (err) {
  printError(err);
  await sequelize.close();
  process.exit(1);
}

try {
  const db = createSqlRunner(sequelize);
  const info = await db.select(
    'SELECT @@SERVERNAME AS server_name, DB_NAME() AS db_name, SYSTEM_USER AS login_name',
  );
  console.log('連線成功：', info[0]);

  const setting = await db.select(
    'SELECT TOP 1 sss_smtr, sss_type, sss_state, sss_beginTime, sss_endTime FROM [OIT].[dbo].[v_selcostime_setting]',
  );
  console.log('選課時段設定：', setting[0] ?? '（無資料）');

  if (stdNo) {
    const std = await db.select(
      `SELECT a.std_no, a.chi_name, a.type_no, a.degree, a.class, a.[state], a.dept_no, rp.dept_name_s
       FROM [OIT].[dbo].[dat_std_basic] AS a
       INNER JOIN [OIT].[dbo].[ref_dept] AS rp ON a.dept_no = rp.dept_no
       WHERE a.std_no = $stdNo`,
      { stdNo },
    );
    console.log('學籍：', std[0] ?? '（查無此學號）');
  }
} finally {
  await sequelize.close();
}

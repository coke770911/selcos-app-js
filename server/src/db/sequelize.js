import { QueryTypes, Sequelize } from 'sequelize';
import { env } from '../config/env.js';
import { buildSequelizeOptions } from './connectionConfig.js';

/** @import { Transaction } from 'sequelize' */

/** @typedef {Record<string, unknown>} BindParams 具名參數，SQL 內以 $名稱 引用 */

/**
 * 原生 SQL 執行介面（SP、View、跨資料庫 [CACHE] 都用原生 SQL，不定義 model、不 sync 資料表）。
 * 參數一律經 bind 傳給 tedious 參數化，不做字串拼接。
 * @typedef {object} SqlRunner
 * @property {<T = Record<string, unknown>>(sql: string, bind?: BindParams) => Promise<T[]>} select
 *   回傳查詢結果列
 * @property {(sql: string, bind?: BindParams) => Promise<number>} execute 回傳影響筆數
 */

/** @type {Sequelize | undefined} */
let instance;

/** 延遲建立 Sequelize，第一次使用時才連線 */
export function getSequelize() {
  instance ??= new Sequelize(buildSequelizeOptions(env));
  return instance;
}

export async function closeSequelize() {
  await instance?.close();
  instance = undefined;
}

/**
 * 以 Sequelize 執行原生 SQL；傳入 transaction 時在同一個交易（同一條連線）內執行
 * @param {Sequelize} sequelize
 * @param {Transaction} [transaction]
 * @returns {SqlRunner}
 */
export function createSqlRunner(sequelize, transaction) {
  return {
    select(sql, bind) {
      // 不帶 model 時回傳原始資料列，列的型別由呼叫端標註
      return /** @type {Promise<any[]>} */ (
        sequelize.query(sql, { bind, type: QueryTypes.SELECT, transaction })
      );
    },
    async execute(sql, bind) {
      // RAW 查詢回傳 [rows, 影響筆數]
      const [, affected] = await sequelize.query(sql, { bind, type: QueryTypes.RAW, transaction });
      return Number(affected ?? 0);
    },
  };
}

/** 預設的 SqlRunner（不在交易內） */
export function getDb() {
  return createSqlRunner(getSequelize());
}

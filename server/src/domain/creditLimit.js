/** 可選學分上下限（舊系統 process.php） */

/** @import { SelcosMode } from '@selcos/shared' */

/**
 * @typedef {object} CreditLimit
 * @property {number} max
 * @property {number} min
 */

/**
 * cos_std_creditlimit 的一筆設定
 * @typedef {object} CreditLimitRow
 * @property {number} max_credit
 * @property {number} min_credit
 */

/**
 * 找不到學制年級設定時的預設值
 * @type {CreditLimit}
 */
const DEFAULT_LIMIT = { max: 8, min: 0 };

/**
 * - 暑修（模式 3）：學籍 3 年級以上（應屆、畢業生）上限 15，其餘 10，無下限
 * - 其他模式：依學制與選課年級查 cos_std_creditlimit（呼叫端查好傳入 row），延修生無下限
 * @param {{ mode: SelcosMode; degree: number; state: string; row: CreditLimitRow | null }} input
 *   degree：學籍年級（暑修判斷用）
 * @returns {CreditLimit}
 */
export function creditLimit(input) {
  if (input.mode === '3') return { max: input.degree >= 3 ? 15 : 10, min: 0 };
  if (!input.row) return { ...DEFAULT_LIMIT };
  return {
    max: Number(input.row.max_credit),
    min: input.state === '06' ? 0 : Number(input.row.min_credit),
  };
}

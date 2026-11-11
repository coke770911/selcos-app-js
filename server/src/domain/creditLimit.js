/** 可選學分上下限（舊系統 process.php），暑修上限與預設值設定在 ruleSettings.js */
import { RULE_SETTINGS } from './ruleSettings.js';

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

const { credit, studentState } = RULE_SETTINGS;

/**
 * - 暑修（模式 3）：學籍高年級（應屆、畢業生）與其他年級各有上限，無下限
 * - 其他模式：依學制與選課年級查 cos_std_creditlimit（呼叫端查好傳入 row），延修生無下限
 * @param {{ mode: SelcosMode; degree: number; state: string; row: CreditLimitRow | null }} input
 *   degree：學籍年級（暑修判斷用）
 * @returns {CreditLimit}
 */
export function creditLimit(input) {
  if (input.mode === '3') {
    const { upperDegree, upperMax, otherMax } = credit.summer;
    return { max: input.degree >= upperDegree ? upperMax : otherMax, min: 0 };
  }
  if (!input.row) return { ...credit.fallback };
  return {
    max: Number(input.row.max_credit),
    min: input.state === studentState.delayed ? 0 : Number(input.row.min_credit),
  };
}

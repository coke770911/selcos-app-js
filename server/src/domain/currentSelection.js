/**
 * 本學期目前課表摘要（取代舊系統 selcos_main.php 累加在 $_SESSION 的
 * selcos 衝堂表、credit.now、gec 計次、cos_now_sel），每次從資料庫的選課資料重新計算。
 */
import { gecType } from './gec.js';

/** @import { CurrentSelection } from './addRules.js' */

/**
 * @typedef {object} SelectedCourse
 * @property {string} cosId
 * @property {number} credit
 * @property {string[]} periods
 */

/**
 * @param {SelectedCourse[]} courses
 * @returns {CurrentSelection}
 */
export function summarizeSelection(courses) {
  /** @type {CurrentSelection} */
  const summary = {
    cosIds: [],
    periods: new Set(),
    credit: 0,
    gec: { P: 0, T: 0, PE: 0, MT: 0, N: 0 },
  };
  for (const c of courses) {
    summary.cosIds.push(c.cosId);
    summary.credit += c.credit;
    summary.gec[gecType(c.cosId)] += 1;
    for (const p of c.periods) summary.periods.add(p);
  }
  return summary;
}

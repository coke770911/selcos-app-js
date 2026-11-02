/**
 * 重修、補修清單（舊系統 process.php，只在加退選、暑修計算）。
 * 課程以「課號_冊別」表示，例如 1CC1001_1。
 * 特殊身分、體育門數與補修課號、核通類別設定在 ruleSettings.js。
 */
import { RULE_SETTINGS } from './ruleSettings.js';

/**
 * @import { SelcosMode } from '@selcos/shared'
 * @import { GecPassCounts } from './gec.js'
 */

const { specialStdTypes, pe, coreCategories } = RULE_SETTINGS;

/** @param {string} cosPK */
const isPE = (cosPK) => pe.prefixes.includes(cosPK.slice(0, 7));

/**
 * @typedef {object} RetakeLists
 * @property {string[]} failed 重修清單：不及格且之後未通過的課
 * @property {string[]} needFill 補修清單：轉學轉系生應修未修的必修課
 */

/**
 * @param {{
 *   mode: SelcosMode;
 *   stdType: string;
 *   passed: string[];
 *   failed: string[];
 *   mustCourses: string[];
 *   gec: GecPassCounts;
 * }} input passed：已及格的課（含重複）；failed：不及格的課；
 *   mustCourses：轉學轉系生依入學年、系、組應修的必修課（cos_ref_must_cos 與抵免對照）
 * @returns {RetakeLists}
 */
export function buildRetakeLists(input) {
  if (input.mode === '1') return { failed: [], needFill: [] };

  const passed = new Set(input.passed);
  const peDone = input.gec.PE >= pe.required;

  const failed = unique(input.failed).filter((pk) => !passed.has(pk) && !(isPE(pk) && peDone));

  const rawNeedFill = specialStdTypes.includes(input.stdType) ? unique(input.mustCourses) : [];
  /** @type {string[]} */
  let needFill = [];
  if (rawNeedFill.length > 0) {
    // 核心通識已修過該類別就不必補修
    needFill = rawNeedFill.filter((pk) => {
      if (isPE(pk) || passed.has(pk)) return false;
      const core = coreCategories[pk.slice(0, 7)];
      return !(core && input.gec[core.key] >= 1);
    });
    // 與舊系統相同：原本有補修清單時，體育未修滿就補上體育（即使過濾後清單已空）
    if (!peDone) needFill.push(...pe.makeUpCourses);
  }

  return { failed, needFill };
}

/**
 * @param {string[]} list
 * @returns {string[]}
 */
function unique(list) {
  return [...new Set(list)];
}

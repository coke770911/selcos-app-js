/**
 * 重修、補修清單（舊系統 process.php，只在加退選、暑修計算）。
 * 課程以「課號_冊別」表示，例如 1CC1001_1。
 */

/**
 * @import { SelcosMode } from '@selcos/shared'
 * @import { GecPassCounts } from './gec.js'
 */

/** 需要補修必修課的特殊身分：1 轉系、2 轉學、9 其他 */
const MAKE_UP_STD_TYPES = ['1', '2', '9'];
/** 體育課號前 7 碼 */
const PE_PREFIXES = ['1CC1998', '1CC1999'];
/** 體育修滿門數 */
const PE_REQUIRED = 4;
/** 補修時遇到體育，改用這兩門讓學生加選 */
const PE_MAKE_UP = ['1CC1998_1', '1CC1999_1'];
/** 核心通識：已修過該類別就不必補修 */
/** @satisfies {Record<string, keyof GecPassCounts>} */
const CORE_CATEGORY_BY_PREFIX = /** @type {const} */ ({
  '1CC1200': 'P1',
  '1CC1220': 'P2',
  '1CC1230': 'P3',
  '1CC1250': 'P4',
});

/** @param {string} cosPK */
const isPE = (cosPK) => PE_PREFIXES.includes(cosPK.slice(0, 7));

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
  const peDone = input.gec.PE >= PE_REQUIRED;

  const failed = unique(input.failed).filter((pk) => !passed.has(pk) && !(isPE(pk) && peDone));

  const rawNeedFill = MAKE_UP_STD_TYPES.includes(input.stdType) ? unique(input.mustCourses) : [];
  /** @type {string[]} */
  let needFill = [];
  if (rawNeedFill.length > 0) {
    needFill = rawNeedFill.filter((pk) => {
      if (isPE(pk) || passed.has(pk)) return false;
      const core =
        CORE_CATEGORY_BY_PREFIX[
          /** @type {keyof typeof CORE_CATEGORY_BY_PREFIX} */ (pk.slice(0, 7))
        ];
      return !(core && input.gec[core] >= 1);
    });
    // 與舊系統相同：原本有補修清單時，體育未修滿就補上體育（即使過濾後清單已空）
    if (!peDone) needFill.push(...PE_MAKE_UP);
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

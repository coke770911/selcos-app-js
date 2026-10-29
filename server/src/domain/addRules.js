/**
 * 加選規則（舊系統 ajax_cos_add.php），依舊系統順序檢查，第一個不通過的規則回傳訊息。
 * 純函式：課程、前置資料、目前課表與指定系所、同性質課程資料由呼叫端查好傳入。
 */
import { gecType, liberalArtsPassed } from './gec.js';

/**
 * @import { SelcosMode } from '@selcos/shared'
 * @import { GecPassCounts, GecType } from './gec.js'
 */

/**
 * 學期開課資料中加選規則用到的欄位
 * @typedef {object} RuleCourse
 * @property {string} cosId
 * @property {string} cosClass
 * @property {string} cosTerm
 * @property {string} cosYear 開課年級
 * @property {string} selType 課別 cos_sel_type
 * @property {number} credit
 * @property {string[]} periods
 * @property {string} deptNo 開課系所代碼 cos_dept_no（第 1 碼為學制）
 * @property {string} dept 課程所屬系 cos_dept
 * @property {number} maxStudents
 * @property {number} minStudents
 * @property {number} selected 目前已選人數
 * @property {boolean} chkMaxNum
 * @property {boolean} chkMinNum
 * @property {boolean} canInsert
 * @property {boolean} canDelete
 * @property {boolean} chkCollege
 * @property {boolean} chkDept
 * @property {boolean} chkSelcosDept
 * @property {number} overYear 可選年級為大於 overYear 且小於 underYear
 * @property {number} underYear
 */

/**
 * 學生本學期目前已選的課（每次從資料庫即時計算）
 * @typedef {object} CurrentSelection
 * @property {string[]} cosIds
 * @property {Set<string>} periods
 * @property {number} credit
 * @property {Record<GecType, number>} gec
 */

/**
 * 加選需要的前置資料（SelectionContext 的子集）
 * @typedef {object} AddRuleContext
 * @property {SelcosMode} mode
 * @property {{ typeNo: string; deptNo: string; class: string; state: string; academicYear: string }} student
 * @property {number} currentDegree
 * @property {{ max: number; min: number }} credit
 * @property {string[]} passed
 * @property {string[]} failed
 * @property {string[]} needFill
 * @property {GecPassCounts} gec
 * @property {{
 *   checkStudentMax: boolean;
 *   checkPrerequisite: boolean;
 *   firstYearCoursesBlocked: boolean;
 *   checkDegree: boolean;
 * }} rules
 */

/**
 * cos_more_dept 指定可修系所年班（已依學生系所、班級、年級篩選）
 * @typedef {object} MoreDeptRow
 * @property {string} moreFlag
 */

/**
 * @typedef {object} AddRuleInput
 * @property {RuleCourse} course
 * @property {AddRuleContext} ctx
 * @property {CurrentSelection} current
 * @property {MoreDeptRow[] | null} moreDept 課程有 chk_selcos_dept 時才需要；其他情況可為 null
 * @property {string[]} clashCosIds 與此課程同性質（cos_clash）的課號
 */

/** @typedef {{ ok: true; selType: string } | { ok: false; message: string }} AddRuleResult */

/** 舊系統寫死的特殊課號 */
const SPECIAL_COURSES = ['1CC1998Z'];
/** 112 學年後入學者不可選的博雅世界文明類 */
const RETIRED_LIBERAL_PREFIX = '1CC132';
const PE_PREFIXES = ['1CC1998', '1CC1999'];
/** 核通、博雅重修可修同類（比對前 6 碼） */
const CHANGEABLE_RETAKE_PREFIXES = [
  '1CC120',
  '1CC122',
  '1CC123',
  '1CC125',
  '1CC131',
  '1CC132',
  '1CC133',
  '1CC134',
  '1CC135',
];
/** @type {Record<string, { key: keyof GecPassCounts; name: string }>} */
const CORE_CATEGORY = {
  '1CC1200': { key: 'P1', name: '知識創新' },
  '1CC1220': { key: 'P2', name: '歷史文化' },
  '1CC1230': { key: 'P3', name: '經典閱讀' },
  '1CC1250': { key: 'P4', name: '公民素養' },
};

/** @typedef {(input: AddRuleInput) => string | null} Rule */

/**
 * 第一段：基本限制（依舊系統順序）
 * @type {Rule[]}
 */
const BASIC_RULES = [
  ({ course }) => (SPECIAL_COURSES.includes(course.cosId) ? '此課程為特殊課程無法加選！' : null),

  ({ course, ctx }) =>
    course.cosId.slice(0, 6) === RETIRED_LIBERAL_PREFIX && Number(ctx.student.academicYear) >= 112
      ? '此課程非課綱內通識，無法加選！'
      : null,

  ({ course, ctx }) =>
    ctx.rules.firstYearCoursesBlocked && course.cosYear === '1'
      ? '新學年第一學期無法加選一年級課程！'
      : null,

  // 本學期已選過（體育可重複選）；核通同類一學期只能一門
  ({ course, current }) => {
    if (current.cosIds.length === 0) return null;
    if (gecType(course.cosId) !== 'PE' && current.cosIds.includes(course.cosId)) {
      return '您這學期課表已選過此課程！';
    }
    if (
      course.selType === 'P' &&
      current.cosIds.some((id) => id.slice(0, 6) === course.cosId.slice(0, 6))
    ) {
      return '您這學期課表已選過相同核心通識課程！';
    }
    return null;
  },

  ({ course, current }) =>
    course.periods.some((p) => current.periods.has(p)) ? '此課程與您目前課表衝堂！' : null,

  ({ course, ctx, current }) =>
    current.credit + course.credit > ctx.credit.max ? '無法加選課程，學分已超出上限！' : null,

  // 已修過並及格（體育除外）
  ({ course, ctx }) => {
    const pk = `${course.cosId}_${course.cosTerm}`;
    return ctx.passed.some((v) => gecType(v) !== 'PE' && v === pk)
      ? '此課程你已修過並及格通過！'
      : null;
  },

  // 體育：最多修畢 4 門；每學期 1 門（未擋修且 3 年級以上可 2 門）
  ({ course, ctx, current }) => {
    if (gecType(course.cosId) !== 'PE') return null;
    const passed = ctx.gec.PE;
    const perSemester = !ctx.rules.checkPrerequisite && ctx.currentDegree >= 3 ? 2 : 1;
    if (passed >= 4) return `您已修${passed}門體育課程！，不需要再選體育！`;
    if (current.gec.PE + passed >= 4) return `您已修${passed}門體育課程，最多修畢四門體育！`;
    if (current.gec.PE >= perSemester) return `您這學期已選過${current.gec.PE}門體育課程！`;
    return null;
  },

  // 核心通識：每類只需修過一次
  ({ course, ctx }) => {
    if (course.selType !== 'P') return null;
    const category = CORE_CATEGORY[course.cosId.slice(0, 7)];
    return category && ctx.gec[category.key] >= 1 ? `您已選過核心通識[${category.name}]類！` : null;
  },

  // 博雅通識：112 學年後 4 門（至少 2 類），之前 5 門（至少 3 類）
  ({ course, ctx, current }) => {
    if (course.selType !== 'T') return null;
    const passed = liberalArtsPassed(ctx.gec);
    if (Number(ctx.student.academicYear) >= 112) {
      if (passed >= 4)
        return '您已修過四門博雅通識不需再選，請確認博雅通識類別是否已修過二類以上！';
      if (passed + current.gec.T >= 4) {
        return '您已修過博雅通識與目前加選的博雅通識，已達四門博雅通識無法再加選！';
      }
    } else {
      if (passed >= 5)
        return '您已修過五門博雅通識不需再選，請確認博雅通識類別是否已修過三類以上！';
      if (passed + current.gec.T >= 5) {
        return '您已修過博雅通識與目前加選的博雅通識，已達五門博雅通識無法再加選！';
      }
    }
    return null;
  },

  ({ course, ctx }) =>
    ctx.rules.checkStudentMax && course.chkMaxNum && course.selected >= course.maxStudents
      ? '此課程人數已達上限，不可再加選！'
      : null,
];

/**
 * 重修、補修判定（非預選）：符合時課別改為 S（補修）或 R（重修），並略過選課條件檢查。
 * 與舊系統相同：核通、博雅比對時會把比對用課號改成前 7 碼，影響後續比對。
 * @param {RuleCourse} course
 * @param {AddRuleContext} ctx
 * @returns {{ skipConditions: boolean; selType: string }}
 */
export function resolveRetake(course, ctx) {
  let selType = course.selType;
  if (ctx.mode === '1') return { skipConditions: false, selType };

  let check = `${course.cosId}_${course.cosTerm}`;
  let skip = false;

  if (ctx.needFill.includes(check)) {
    skip = true;
    selType = 'S';
  }

  for (const val of ctx.failed) {
    if (check === val) {
      skip = true;
      selType = 'R';
      break;
    }
    if (selType === 'P' || selType === 'T') {
      check = `${course.cosId.slice(0, 7)}_${course.cosTerm}`;
      if (
        CHANGEABLE_RETAKE_PREFIXES.includes(val.slice(0, 6)) &&
        check.slice(0, 6) === val.slice(0, 6)
      ) {
        skip = true;
        selType = 'R';
        break;
      }
    }
    if (
      PE_PREFIXES.includes(course.cosId.slice(0, 7)) &&
      course.cosId.slice(0, 6) === val.slice(0, 6)
    ) {
      skip = true;
      selType = 'R';
      break;
    }
  }
  return { skipConditions: skip, selType };
}

/**
 * 年級範圍提示（舊系統訊息）
 * @param {number} over
 * @param {number} under
 * @returns {string}
 */
function degreeMessage(over, under) {
  return over + 1 === under - 1
    ? `此課程限定${over + 1}年級同學才可加選`
    : `此課程限定${over + 1}年級到${under - 1}年級的同學才可加選`;
}

/**
 * 第二段：選課條件（重修、補修可略過）
 * @param {AddRuleInput} input
 * @returns {string | null}
 */
function checkConditions({ course, ctx, moreDept }) {
  if (!course.canInsert) return '此課程設定不可加選。';

  if (course.chkCollege) {
    return ctx.student.typeNo !== course.deptNo.slice(0, 1) ? '學制相同才能加選！' : null;
  }

  // 設定檢查年級，或非延修生，都要檢查年級範圍
  if (ctx.rules.checkDegree || ctx.student.state !== '06') {
    const degree = ctx.currentDegree;
    if (!(degree > course.overYear && degree < course.underYear)) {
      return degreeMessage(course.overYear, course.underYear);
    }
  }

  if (course.chkDept && ctx.student.deptNo !== course.dept) return '同系才能加選！';

  if (course.chkSelcosDept) {
    if (!moreDept || moreDept.length === 0) return '此課程目前不開放您的系所選修！';
    if (moreDept.some((m) => m.moreFlag !== 'Y')) {
      return '此課程目前只開放限定系所、年級、班級選修，詳細請看通識中心與教務行政組公告！';
    }
  }
  return null;
}

/**
 * 檢查是否可加選；可加選時回傳寫入用的課別
 * @param {AddRuleInput} input
 * @returns {AddRuleResult}
 */
export function checkAdd(input) {
  for (const rule of BASIC_RULES) {
    const message = rule(input);
    if (message) return { ok: false, message };
  }

  const { skipConditions, selType } = resolveRetake(input.course, input.ctx);
  if (!skipConditions) {
    const message = checkConditions(input);
    if (message) return { ok: false, message };
  }

  // 同性質課程：其他學期已修過（及格）就不能再選
  const passedIds = new Set(input.ctx.passed.map((pk) => pk.split('_')[0]));
  if (input.clashCosIds.some((id) => passedIds.has(id))) {
    return { ok: false, message: '重複選課！此課程已在其他學期選過！' };
  }

  return { ok: true, selType: input.ctx.mode === '3' ? 'J' : selType };
}

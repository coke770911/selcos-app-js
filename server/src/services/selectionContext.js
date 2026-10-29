/**
 * 選課前置資料（取代舊系統 process.php 存在 $_SESSION 的 env / userinfo / cos_pass / cos_nopass /
 * cos_need_fill / gec_passArr / credit）。登入時計算一次，存在共用快取供加退選使用。
 */
import { checkEligibility, currentDegree, requiresQuestionnaire } from '../domain/eligibility.js';
import { creditLimit } from '../domain/creditLimit.js';
import { countGecPassed } from '../domain/gec.js';
import { buildRetakeLists } from '../domain/retake.js';

/**
 * @import { SelcosMode } from '@selcos/shared'
 * @import { CacheStore } from '../cache/CacheStore.js'
 * @import { CreditLimit } from '../domain/creditLimit.js'
 * @import { GecPassCounts } from '../domain/gec.js'
 * @import { SelcosSettingRow, StudentRow } from '../db/repositories/authRepository.js'
 * @import { SelectionContextRepository } from '../db/repositories/selectionContextRepository.js'
 */

/** 轉學轉系等需要補修的特殊身分 */
const MAKE_UP_STD_TYPES = ['1', '2', '9'];

/**
 * @typedef {object} SelectionContext
 * @property {string} stdNo
 * @property {string} smtr
 * @property {SelcosMode} mode
 * @property {{
 *   typeNo: string;
 *   deptNo: string;
 *   class: string;
 *   team: string;
 *   state: string;
 *   stdType: string;
 *   academicYear: string;
 * }} student
 * @property {number} currentDegree 選課用年級（含預選虛擬升級、延修上限）
 * @property {CreditLimit} credit
 * @property {string[]} passed 已及格課程（課號_冊別，含重複）
 * @property {string[]} failed 重修清單
 * @property {string[]} needFill 補修清單
 * @property {GecPassCounts} gec
 * @property {SelectionRules} rules 本時段的選課檢查開關（v_selcostime_setting）
 */

/**
 * @typedef {object} SelectionRules
 * @property {boolean} courseMinCanDrop 低於課程人數下限時可退 chk_sel_cosmin_can_del
 * @property {boolean} checkStudentMin 檢查課程人數下限 chk_sel_stdnum_min
 * @property {boolean} checkStudentMax 檢查課程人數上限 chk_sel_stdnum_max
 * @property {boolean} checkPrerequisite 檢查擋修 chk_pre_cos
 * @property {boolean} firstYearCoursesBlocked 一年級課程不可選 sss_1degreeNoAgree
 * @property {boolean} checkDegree 檢查課程年級 chk_access_degree
 */

/** @typedef {{ ok: true; context: SelectionContext } | { ok: false; message: string }} BuildContextResult */

/** @param {unknown} v */
const flag = (v) => String(v ?? '').trim() === 'Y';
/** @param {unknown} v */
const trim = (v) => String(v ?? '').trim();

/**
 * @param {{
 *   repo: SelectionContextRepository;
 *   student: StudentRow;
 *   setting: SelcosSettingRow;
 *   mode: SelcosMode;
 *   isAdmin: boolean;
 * }} input
 * @returns {Promise<BuildContextResult>}
 */
export async function buildSelectionContext(input) {
  const { repo, setting, mode, isAdmin } = input;
  const smtr = trim(setting.sss_smtr);
  const s = input.student;
  const student = {
    typeNo: trim(s.type_no),
    deptNo: trim(s.dept_no),
    class: trim(s.class),
    team: trim(s.team),
    state: trim(s.state),
    stdType: trim(s.std_type),
    academicYear: trim(s.Academic_year),
  };
  const stdNo = trim(s.std_no);
  const degree = Number(s.degree);
  const eligibilitySetting = /** @type {Parameters<typeof checkEligibility>[0]['setting']} */ ({
    .../** @type {Record<string, unknown>} */ (setting),
    sss_smtr: smtr,
  });

  const questionnaireDone =
    !isAdmin && requiresQuestionnaire(eligibilitySetting, mode)
      ? await repo.hasQuestionnaire(trim(setting.sss_question_smtr), stdNo)
      : undefined;
  const error = checkEligibility({
    student: { degree, typeNo: student.typeNo, state: student.state, stdType: student.stdType },
    setting: eligibilitySetting,
    mode,
    isAdmin,
    questionnaireDone,
  });
  if (error) return { ok: false, message: error };

  const nowDegree = currentDegree({ degree, state: student.state }, mode, smtr);
  const needsMakeUp = mode !== '1' && MAKE_UP_STD_TYPES.includes(student.stdType);

  const [records, creditRow, mustCourses] = await Promise.all([
    repo.findCourseRecords(stdNo),
    mode === '3' ? null : repo.findCreditLimit(student.typeNo, nowDegree),
    needsMakeUp
      ? repo.findMustCourses({
          academicYear: student.academicYear,
          deptNo: student.deptNo,
          team: student.team,
          smtr,
        })
      : [],
  ]);

  const passed = records.filter((r) => r.passed).map((r) => r.cosPK);
  const gec = countGecPassed(passed);
  const { failed, needFill } = buildRetakeLists({
    mode,
    stdType: student.stdType,
    passed,
    failed: records.filter((r) => !r.passed).map((r) => r.cosPK),
    mustCourses,
    gec,
  });

  return {
    ok: true,
    context: {
      stdNo,
      smtr,
      mode,
      student,
      currentDegree: nowDegree,
      credit: creditLimit({ mode, degree, state: student.state, row: creditRow }),
      passed,
      failed,
      needFill,
      gec,
      rules: {
        courseMinCanDrop: flag(setting.chk_sel_cosmin_can_del),
        checkStudentMin: flag(setting.chk_sel_stdnum_min),
        checkStudentMax: flag(setting.chk_sel_stdnum_max),
        checkPrerequisite: flag(setting.chk_pre_cos),
        firstYearCoursesBlocked: flag(setting.sss_1degreeNoAgree),
        checkDegree: flag(setting.chk_access_degree),
      },
    },
  };
}

/** @param {string} stdNo */
const contextKey = (stdNo) => `context:${stdNo}`;

/**
 * 存取共用快取中的選課前置資料（負載平衡下各台都讀得到）
 * @param {CacheStore} cache
 */
export function createSelectionContextStore(cache) {
  return {
    /**
     * @param {SelectionContext} ctx
     * @param {number} ttlSeconds
     */
    save: (ctx, ttlSeconds) => cache.set(contextKey(ctx.stdNo), ctx, ttlSeconds),
    /**
     * @param {string} stdNo
     * @returns {Promise<SelectionContext | undefined>}
     */
    load: (stdNo) => cache.get(contextKey(stdNo)),
    /** @param {string} stdNo */
    remove: (stdNo) => cache.del(contextKey(stdNo)),
  };
}

/** @typedef {ReturnType<typeof createSelectionContextStore>} SelectionContextStore */

/**
 * 登入選課的開放條件與虛擬年級（舊系統 process.php）。
 * 純函式：資料由呼叫端查好傳入，方便測試。
 */

/** @import { SelcosMode } from '@selcos/shared' */

/**
 * 開放條件需要的時段設定欄位（v_selcostime_setting）
 * @typedef {object} EligibilitySetting
 * @property {string} sss_smtr
 * @property {string} [sss_1degree]
 * @property {string} [sss_2degree]
 * @property {string} [sss_3degree]
 * @property {string} [sss_4degree]
 * @property {string} [sss_5degree]
 * @property {string} [sss_delayDegree]
 * @property {string} [sss_chk_std_type]
 * @property {string} [chk_question]
 * @property {string} [sss_question_smtr]
 */

/**
 * @typedef {object} EligibilityStudent
 * @property {number} degree 學籍年級
 * @property {string} typeNo 學制 type_no
 * @property {string} state 01 在學、06 延修
 * @property {string} stdType 1 轉系、2 轉學、9 其他特殊身分
 */

const STATE_ENROLLED = '01';
const STATE_DELAYED = '06';
/** 二技學制年級需 +2 才對應時段設定的年級欄位 */
const TWO_YEAR_TYPES = ['2', 'R'];
/** 轉學、轉系等特殊身分 */
const SPECIAL_STD_TYPES = ['1', '2', '9'];

export const NOT_OPEN_MESSAGE = '尚未開放您的系別年級選課，詳細請查閱教務處選課時間公告！';
export const QUESTIONNAIRE_MESSAGE = '您的學期評量問卷尚未填寫完畢，填寫後即可預選。';

/**
 * 依年級、延修、特殊身分判斷目前時段是否開放此學生登入
 * @param {EligibilityStudent} student
 * @param {EligibilitySetting} setting
 * @returns {boolean}
 */
export function isOpenForStudent(student, setting) {
  const degree = TWO_YEAR_TYPES.includes(student.typeNo) ? student.degree + 2 : student.degree;
  const degreeFlag = setting[/** @type {keyof EligibilitySetting} */ (`sss_${degree}degree`)];

  if (student.state === STATE_ENROLLED && degreeFlag === 'Y') return true;
  if (setting.sss_delayDegree === 'Y' && student.state === STATE_DELAYED) return true;
  if (setting.sss_chk_std_type === 'Y' && SPECIAL_STD_TYPES.includes(student.stdType)) return true;
  return false;
}

/**
 * 預選階段且設定要求時，需檢查學期評量問卷
 * @param {EligibilitySetting} setting
 * @param {SelcosMode} mode
 * @returns {boolean}
 */
export function requiresQuestionnaire(setting, mode) {
  return mode === '1' && setting.chk_question === 'Y';
}

/**
 * 登入檢查：回傳不可登入的原因，可登入時回傳 null。
 * 管理員代登不受開放條件與問卷限制（方便測試流程）。
 * @param {{
 *   student: EligibilityStudent;
 *   setting: EligibilitySetting;
 *   mode: SelcosMode;
 *   isAdmin: boolean;
 *   questionnaireDone?: boolean;
 * }} input questionnaireDone：問卷是否已填；不需檢查問卷時可省略
 * @returns {string | null}
 */
export function checkEligibility(input) {
  if (input.isAdmin) return null;
  if (!isOpenForStudent(input.student, input.setting)) return NOT_OPEN_MESSAGE;
  if (requiresQuestionnaire(input.setting, input.mode) && !input.questionnaireDone) {
    return QUESTIONNAIRE_MESSAGE;
  }
  return null;
}

/**
 * 選課用的「目前年級」：
 *   - 預選且為第一學期（學期代碼結尾 1）時，視為已升上一年級
 *   - 延修生最多以 4 年級計算
 * @param {Pick<EligibilityStudent, 'degree' | 'state'>} student
 * @param {SelcosMode} mode
 * @param {string} smtr
 * @returns {number}
 */
export function currentDegree(student, mode, smtr) {
  let degree = student.degree;
  if (mode === '1' && smtr.endsWith('1')) degree += 1;
  if (degree >= 5 && student.state === STATE_DELAYED) degree = 4;
  return degree;
}

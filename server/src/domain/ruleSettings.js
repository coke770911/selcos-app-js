/**
 * 選課規則的例外條件與門檻（集中設定）。
 * 需求單位調整特殊課號、學年分界、門數、學分上限、特殊身分等條件時，只改這個檔案；
 * 規則的判斷流程在 addRules.js、dropRules.js、retake.js、creditLimit.js、eligibility.js、gec.js。
 *
 * 課號格式：第 1 碼學制、第 2–3 碼 CC 為通識、第 4–7 碼為通識分類代碼，例如 1CC1200xx。
 * 修課紀錄以「課號_冊別」表示，例如 1CC1001_1。
 * 修改後執行 `npm test` 與 `npm run typecheck`，確認規則測試與型別都通過。
 */

/**
 * @import { GecPassCategory, GecType } from './gec.js'
 */

/**
 * @typedef {object} LiberalArtsPolicy 博雅通識應修門數（依入學學年度）
 * @property {number} fromAcademicYear 入學學年度大於等於此值適用（由新到舊排列，第一筆符合者生效）
 * @property {number} required 應修門數，修滿後不可再選
 * @property {number} minCategories 至少需涵蓋的類別數（僅用於提示訊息）
 */

/**
 * @typedef {object} RuleSettings
 * @property {{ enrolled: string; delayed: string }} studentState 學籍狀態代碼：在學、延修
 * @property {readonly string[]} specialStdTypes 特殊身分（1 轉系、2 轉學、9 其他）：可登入特殊時段、需補修必修
 * @property {readonly string[]} twoYearTypes 二技學制：年級 +2 才對應時段設定的年級欄位
 * @property {readonly string[]} blockedCourses 不可加選的特殊課號
 * @property {{ prefix: string; fromAcademicYear: number }} retiredLiberalArts
 *   停開的博雅類別：課號前 6 碼為 prefix，且入學學年度大於等於 fromAcademicYear 的學生不可選
 * @property {{
 *   prefixes: readonly string[];
 *   required: number;
 *   perSemester: number;
 *   upperDegree: { minDegree: number; perSemester: number };
 *   makeUpCourses: readonly string[];
 * }} pe 體育：
 *   prefixes 課號前 7 碼；required 應修滿門數；perSemester 每學期可選門數；
 *   upperDegree 未擋修時，選課年級 minDegree 以上每學期可選 perSemester 門；
 *   makeUpCourses 轉學轉系生體育未修滿時加入補修清單的課（課號_冊別）
 * @property {Readonly<Record<string, { key: 'P1' | 'P2' | 'P3' | 'P4'; name: string }>>} coreCategories
 *   核心通識類別（課號前 7 碼）：每類只需修過一次，修過的類別不必補修
 * @property {readonly LiberalArtsPolicy[]} liberalArts 博雅通識應修門數
 * @property {readonly string[]} changeableRetakePrefixes 核通、博雅重修可改修同類課程的類別（課號前 6 碼）
 * @property {{
 *   summer: { upperDegree: number; upperMax: number; otherMax: number };
 *   fallback: { max: number; min: number };
 * }} credit 學分上下限：
 *   summer 暑修依學籍年級，upperDegree 以上上限 upperMax、其餘 otherMax，無下限；
 *   fallback 找不到學制年級設定（cos_std_creditlimit）時使用
 * @property {{
 *   types: Readonly<Record<Exclude<GecType, 'N'>, readonly string[]>>;
 *   passCategories: Readonly<Partial<Record<GecPassCategory, readonly string[]>>>;
 *   byTerm: Readonly<Record<string, readonly [first: GecPassCategory, other: GecPassCategory]>>;
 *   labels: Readonly<Record<string, { kind: 'pe' | 'military'; tag: string }>>;
 * }} gec 通識分類代碼（課號第 4–7 碼）：
 *   types 選課用的通識類型；passCategories 已修通過的計次類別；
 *   byTerm 國文、英文依冊別區分上下冊（冊別結尾 1 為上冊）；labels 課程清單的體育、軍訓標籤
 */

/** @type {RuleSettings} */
export const RULE_SETTINGS = {
  studentState: { enrolled: '01', delayed: '06' },
  specialStdTypes: ['1', '2', '9'],
  twoYearTypes: ['2', 'R'],

  blockedCourses: ['1CC1998Z'],
  retiredLiberalArts: { prefix: '1CC132', fromAcademicYear: 112 },

  pe: {
    prefixes: ['1CC1998', '1CC1999'],
    required: 4,
    perSemester: 1,
    upperDegree: { minDegree: 3, perSemester: 2 },
    makeUpCourses: ['1CC1998_1', '1CC1999_1'],
  },

  coreCategories: {
    '1CC1200': { key: 'P1', name: '知識創新' },
    '1CC1220': { key: 'P2', name: '歷史文化' },
    '1CC1230': { key: 'P3', name: '經典閱讀' },
    '1CC1250': { key: 'P4', name: '公民素養' },
  },

  liberalArts: [
    { fromAcademicYear: 112, required: 4, minCategories: 2 },
    { fromAcademicYear: 0, required: 5, minCategories: 3 },
  ],

  changeableRetakePrefixes: [
    '1CC120',
    '1CC122',
    '1CC123',
    '1CC125',
    '1CC131',
    '1CC132',
    '1CC133',
    '1CC134',
    '1CC135',
  ],

  credit: {
    summer: { upperDegree: 3, upperMax: 15, otherMax: 10 },
    fallback: { max: 8, min: 0 },
  },

  gec: {
    types: {
      P: ['1200', '1220', '1230', '1250'],
      T: ['1300', '1310', '1320', '1321', '1330', '1331', '1340', '1341', '1350', '1351'],
      PE: ['1998', '1999', '2998'],
      MT: ['1996', '1997', '2023', '2024', '2026', '2027', '2028', '2029'],
    },
    passCategories: {
      EG3: ['1119'],
      EG4: ['1110', '1111', '1112', '1117'],
      EG5: ['1113', '1114', '1115', '1116', '1118'],
      P1: ['1200'],
      P2: ['1220'],
      P3: ['1230'],
      P4: ['1250'],
      T1: ['1300', '1310', '1311'],
      T2: ['1320', '1321'],
      T3: ['1330', '1331'],
      T4: ['1340', '1341'],
      T5: ['1350', '1351'],
      PE: ['1998', '1999'],
      MT: ['1996', '1997'],
    },
    byTerm: {
      1001: ['CH1', 'CH2'],
      1003: ['EG1', 'EG2'],
    },
    labels: {
      1998: { kind: 'pe', tag: '[體育]' },
      1999: { kind: 'pe', tag: '[體育]' },
      1996: { kind: 'military', tag: '[軍訓]' },
      1997: { kind: 'military', tag: '[軍訓]' },
    },
  },
};

/**
 * 依入學學年度取得博雅通識應修門數
 * @param {string | number} academicYear
 * @returns {LiberalArtsPolicy}
 */
export function liberalArtsPolicy(academicYear) {
  const year = Number(academicYear);
  const policies = RULE_SETTINGS.liberalArts;
  // 學年度無法解析時與舊系統相同，套用最舊的設定
  const policy = policies.find((p) => year >= p.fromAcademicYear) ?? policies[policies.length - 1];
  if (!policy) throw new Error('RULE_SETTINGS.liberalArts 至少要有一筆設定');
  return policy;
}

const ZH_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/**
 * 提示訊息用的中文數字（0–10），超過時用阿拉伯數字
 * @param {number} n
 * @returns {string}
 */
export function zhNumber(n) {
  return ZH_DIGITS[n] ?? String(n);
}

/**
 * 日間部通識課號分類（舊系統 fun_tools.php gec_checkType 與 process.php 通識計次）。
 * 課號格式：第 2–3 碼為 CC 才是通識，第 4–7 碼為分類代碼，例如 1CC1200xx。
 * 修課紀錄的 cosPK 為「課號_冊別」，例如 1CC1001_1。
 */

/** @typedef {'P' | 'T' | 'PE' | 'MT' | 'N'} GecType 選課時用的通識類型：P 核心、T 博雅、PE 體育、MT 軍訓、N 其他 */

/**
 * 已修通過的通識類別（計次用）：
 *   P1 知識創新、P2 歷史文化、P3 經典閱讀、P4 公民素養、
 *   T1 哲學道德、T2 世界文明、T3 文學藝術、T4 生涯發展、T5 科學社會、
 *   PE 體育、MT 軍訓、CH1 國文上、CH2 國文下、
 *   EG1 英文上、EG2 英文下、EG3 應用英文、EG4 英文聽說、EG5 英文讀寫
 * @typedef {'P1' | 'P2' | 'P3' | 'P4' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'PE' | 'MT'
 *   | 'CH1' | 'CH2' | 'EG1' | 'EG2' | 'EG3' | 'EG4' | 'EG5'} GecPassCategory
 */

/** @typedef {Record<GecPassCategory, number>} GecPassCounts */

/** @type {Record<string, GecType>} */
const GEC_TYPE_BY_CODE = {
  ...fill(['1200', '1220', '1230', '1250'], 'P'),
  ...fill(['1300', '1310', '1320', '1321', '1330', '1331', '1340', '1341', '1350', '1351'], 'T'),
  ...fill(['1998', '1999', '2998'], 'PE'),
  ...fill(['1996', '1997', '2023', '2024', '2026', '2027', '2028', '2029'], 'MT'),
};

/**
 * 國文、英文上下冊依冊別區分
 * @type {Record<string, [first: GecPassCategory, other: GecPassCategory]>}
 */
const BY_TERM = {
  1001: ['CH1', 'CH2'],
  1003: ['EG1', 'EG2'],
};

/** @type {Record<string, GecPassCategory>} */
const PASS_CATEGORY_BY_CODE = {
  1119: 'EG3',
  ...fill(['1110', '1111', '1112', '1117'], 'EG4'),
  ...fill(['1113', '1114', '1115', '1116', '1118'], 'EG5'),
  1200: 'P1',
  1220: 'P2',
  1230: 'P3',
  1250: 'P4',
  ...fill(['1300', '1310', '1311'], 'T1'),
  ...fill(['1320', '1321'], 'T2'),
  ...fill(['1330', '1331'], 'T3'),
  ...fill(['1340', '1341'], 'T4'),
  ...fill(['1350', '1351'], 'T5'),
  ...fill(['1998', '1999'], 'PE'),
  ...fill(['1996', '1997'], 'MT'),
};

/**
 * @template T
 * @param {string[]} codes
 * @param {T} value
 * @returns {Record<string, T>}
 */
function fill(codes, value) {
  return Object.fromEntries(codes.map((c) => [c, value]));
}

/**
 * 通識分類代碼（第 4–7 碼）；非通識課號回傳 null
 * @param {string} cosId
 * @returns {string | null}
 */
function gecCode(cosId) {
  return cosId.slice(1, 3) === 'CC' ? cosId.slice(3, 7) : null;
}

/**
 * 課程的通識類型（舊系統 gec_checkType）
 * @param {string} cosId
 * @returns {GecType}
 */
export function gecType(cosId) {
  const code = gecCode(cosId);
  return (code && GEC_TYPE_BY_CODE[code]) || 'N';
}

/**
 * 已修課程（cosPK = 課號_冊別）的通識計次類別；不計次者回傳 null
 * @param {string} cosPK
 * @returns {GecPassCategory | null}
 */
export function gecPassCategory(cosPK) {
  const code = gecCode(cosPK);
  if (!code) return null;
  const byTerm = BY_TERM[code];
  if (byTerm) return cosPK.endsWith('1') ? byTerm[0] : byTerm[1];
  return PASS_CATEGORY_BY_CODE[code] ?? null;
}

/** @returns {GecPassCounts} */
export function emptyGecPassCounts() {
  return {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
    T1: 0,
    T2: 0,
    T3: 0,
    T4: 0,
    T5: 0,
    PE: 0,
    MT: 0,
    CH1: 0,
    CH2: 0,
    EG1: 0,
    EG2: 0,
    EG3: 0,
    EG4: 0,
    EG5: 0,
  };
}

/**
 * 依已通過的課程計算各類通識修過次數
 * @param {Iterable<string>} passedCosPKs
 * @returns {GecPassCounts}
 */
export function countGecPassed(passedCosPKs) {
  const counts = emptyGecPassCounts();
  for (const pk of passedCosPKs) {
    const category = gecPassCategory(pk);
    if (category) counts[category] += 1;
  }
  return counts;
}

/**
 * 博雅通識已修總數（T1–T5）
 * @param {GecPassCounts} counts
 * @returns {number}
 */
export function liberalArtsPassed(counts) {
  return counts.T1 + counts.T2 + counts.T3 + counts.T4 + counts.T5;
}

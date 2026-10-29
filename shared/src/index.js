// 前後端共用的型別與常數（型別以 JSDoc @typedef 定義，其他模組用 @import 引用）

/** @typedef {'1' | '2' | '3'} SelcosMode 選課模式：1 預選、2 加退選、3 暑期加退選 */

/** @type {Record<SelcosMode, string>} */
export const SELCOS_MODE_NAME = {
  1: '預選',
  2: '加退選',
  3: '暑期加退選',
};

/** @typedef {'user' | 'admin'} Role 登入角色：一般學生、管理員代登 */

// ---------- 認證 ----------

/**
 * @typedef {object} CaptchaResponse
 * @property {string} captchaId
 * @property {string} svg SVG 圖片內容
 * @property {number} expiresIn 有效秒數
 */

/**
 * @typedef {object} LoginRequest
 * @property {string} account 學號，或管理員代登格式「學號/管理員帳號」
 * @property {string} password
 * @property {string} captchaId
 * @property {string} captcha
 */

/**
 * @typedef {object} SessionUser
 * @property {string} stdNo
 * @property {string} name
 * @property {string} deptNo
 * @property {string} deptName
 * @property {string} typeNo 學制代碼 type_no
 * @property {number} degree 學籍年級
 * @property {Role} role
 * @property {string} [adminId] 管理員代登時的管理員帳號
 * @property {number} currentDegree 選課用年級（預選第一學期會虛擬升一年級、延修生最多 4）
 */

/**
 * 本次可選學分上下限
 * @typedef {object} CreditLimits
 * @property {number} max
 * @property {number} min
 */

/**
 * @typedef {object} SelcosEnv
 * @property {SelcosMode} mode
 * @property {string} modeName
 * @property {string} smtr 選課學期，例如 1142
 */

/**
 * @typedef {object} LoginResponse
 * @property {string} token
 * @property {string} expiresAt token 到期時間（ISO 字串），前端倒數用
 * @property {SessionUser} user
 * @property {SelcosEnv} env
 * @property {CreditLimits} credit
 */

/** @typedef {Omit<LoginResponse, 'token'>} MeResponse */

// ---------- 課程 ----------

/**
 * 課程清單的類別標示（決定顏色，前端依深淺模式對應色碼）。
 * 對應舊系統 get_cos_info() 的各種顏色：
 *   elective 專業選修、通識選修／retakeType 課別為重修／makeUpType 課別為補修／summer 暑修／
 *   required 專業必修／basicGe 基礎通識／categoryGe 分類通識／coreGe 核心通識／
 *   liberalArts 博雅通識／other 其他／pe 體育／military 軍訓／cross 跨域選修／
 *   makeUp 此學生需補修／retake 此學生需重修
 * @typedef {'elective' | 'retakeType' | 'makeUpType' | 'summer' | 'required' | 'basicGe'
 *   | 'categoryGe' | 'coreGe' | 'liberalArts' | 'other' | 'pe' | 'military' | 'cross'
 *   | 'makeUp' | 'retake'} CourseKind
 */

/**
 * @typedef {object} CourseLabel
 * @property {CourseKind} kind
 * @property {string} typeName 類別名稱，例如「專業選修」
 * @property {string} tag 清單前綴，例如「[專選]」
 */

/**
 * 課程唯一識別
 * @typedef {object} CourseKey
 * @property {string} smtr
 * @property {string} cosId
 * @property {string} cosClass
 * @property {string} cosTerm
 */

/**
 * @typedef {CourseKey & {
 *   name: string;
 *   credit: number;
 *   year: string;
 *   periods: string[];
 *   canAdd: boolean;
 *   label: CourseLabel;
 *   foreignLanguage: string;
 *   crossDisciplinary: boolean;
 * }} CourseListItem
 * year：開課年級；periods：上課節次，例如 ['101', '102']（星期 1–7 + 節次 01–15）
 */

/**
 * @typedef {object} CourseFilters
 * @property {{ typeNo: string; typeName: string }[]} types
 * @property {{ deptNo: string; deptName: string; typeNo: string; gradYear: number }[]} depts
 */

/**
 * @typedef {CourseKey & {
 *   name: string;
 *   englishName: string;
 *   teacher: string;
 *   typeName: string;
 *   canAdd: boolean;
 *   canDrop: boolean;
 *   condition: string;
 *   deptName: string;
 *   year: string;
 *   credit: number;
 *   periods: string[];
 *   attributes: { label: string; value: string }[];
 *   minStudents: number;
 *   maxStudents: number;
 *   currentStudents: number;
 *   memo: string;
 *   actions: { add: boolean; drop: boolean };
 * }} CourseInfo
 * typeName：課程類別名稱（舊系統 sel_cos_type）；condition：課程條件說明；
 * actions：彈窗是否顯示加選／退選按鈕（預選依課程設定，其他模式一律顯示）
 */

/**
 * 課表上的一門課
 * @typedef {CourseKey & {
 *   name: string;
 *   credit: number;
 *   periods: string[];
 *   label: CourseLabel;
 *   foreignLanguage: string;
 *   crossDisciplinary: boolean;
 * }} SelectedCourse
 */

/**
 * 目前課表與學分（加退選後回傳最新狀態）
 * @typedef {object} SelectionState
 * @property {SelectedCourse[]} courses
 * @property {{ now: number; max: number; min: number }} credit
 */

/**
 * @typedef {object} EnrollRequest
 * @property {string} cosId
 * @property {string} cosClass
 * @property {string} cosTerm
 */

/** API 錯誤代碼 */
export const ERROR_CODES = /** @type {const} */ ({
  BAD_REQUEST: 'BAD_REQUEST',
  CAPTCHA_INVALID: 'CAPTCHA_INVALID',
  LOGIN_FAILED: 'LOGIN_FAILED',
  NOT_ENROLLED: 'NOT_ENROLLED',
  SYSTEM_CLOSED: 'SYSTEM_CLOSED',
  /** 尚未開放此年級、問卷未填等 */
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  /** 加退選規則不通過（衝堂、學分上限、人數已滿…） */
  ENROLL_REJECTED: 'ENROLL_REJECTED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** 同一帳號在其他地方登入，此 token 已被取代 */
  SESSION_REPLACED: 'SESSION_REPLACED',
  /** 登入已過期或已登出 */
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL: 'INTERNAL',
});

/** @typedef {(typeof ERROR_CODES)[keyof typeof ERROR_CODES]} ErrorCode */

/**
 * API 錯誤回應格式
 * @typedef {object} ApiError
 * @property {string} code
 * @property {string} message
 */

/**
 * 前端顯示用的系統資訊（取代前端 env 檔，設定統一放在 server/.env）
 * @typedef {object} AppInfo
 * @property {string} title
 * @property {string} titleSuffix
 * @property {string} version
 * @property {string} env
 * @property {number} sessionTtlSeconds 每次登入可選課的秒數
 */

/**
 * 登入頁的開放時段公告
 * @typedef {object} ScheduleItem
 * @property {string} begin
 * @property {string} end
 * @property {string[]} groups 可登入的學制年級，例如「四技一年級、碩班一年級」
 */

/**
 * @typedef {object} HealthResponse
 * @property {'ok'} status
 * @property {string} env
 * @property {string} version
 * @property {string} time
 */

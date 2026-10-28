// 前後端共用的型別與常數

/** 選課模式：1 預選、2 加退選、3 暑期加退選 */
export type SelcosMode = '1' | '2' | '3';

export const SELCOS_MODE_NAME: Record<SelcosMode, string> = {
  '1': '預選',
  '2': '加退選',
  '3': '暑期加退選',
};

/** 登入角色：一般學生、管理員代登 */
export type Role = 'user' | 'admin';

// ---------- 認證 ----------

export interface CaptchaResponse {
  captchaId: string;
  /** SVG 圖片內容 */
  svg: string;
  /** 有效秒數 */
  expiresIn: number;
}

export interface LoginRequest {
  /** 學號，或管理員代登格式「學號/管理員帳號」 */
  account: string;
  password: string;
  captchaId: string;
  captcha: string;
}

export interface SessionUser {
  stdNo: string;
  name: string;
  deptNo: string;
  deptName: string;
  /** 學制代碼 type_no */
  typeNo: string;
  /** 學籍年級 */
  degree: number;
  role: Role;
  /** 管理員代登時的管理員帳號 */
  adminId?: string;
  /** 選課用年級（預選第一學期會虛擬升一年級、延修生最多 4） */
  currentDegree: number;
}

/** 本次可選學分上下限 */
export interface CreditLimits {
  max: number;
  min: number;
}

export interface SelcosEnv {
  mode: SelcosMode;
  modeName: string;
  /** 選課學期，例如 1142 */
  smtr: string;
}

export interface LoginResponse {
  token: string;
  /** token 到期時間（ISO 字串），前端倒數用 */
  expiresAt: string;
  user: SessionUser;
  env: SelcosEnv;
  credit: CreditLimits;
}

export type MeResponse = Omit<LoginResponse, 'token'>;

// ---------- 課程 ----------

/**
 * 課程清單的類別標示（決定顏色，前端依深淺模式對應色碼）。
 * 對應舊系統 get_cos_info() 的各種顏色。
 */
export type CourseKind =
  | 'elective' // 專業選修、通識選修
  | 'retakeType' // 課別為重修
  | 'makeUpType' // 課別為補修
  | 'summer' // 暑修
  | 'required' // 專業必修
  | 'basicGe' // 基礎通識
  | 'categoryGe' // 分類通識
  | 'coreGe' // 核心通識
  | 'liberalArts' // 博雅通識
  | 'other' // 其他
  | 'pe' // 體育
  | 'military' // 軍訓
  | 'cross' // 跨域選修
  | 'makeUp' // 此學生需補修
  | 'retake'; // 此學生需重修

export interface CourseLabel {
  kind: CourseKind;
  /** 類別名稱，例如「專業選修」 */
  typeName: string;
  /** 清單前綴，例如「[專選]」 */
  tag: string;
}

/** 課程唯一識別 */
export interface CourseKey {
  smtr: string;
  cosId: string;
  cosClass: string;
  cosTerm: string;
}

export interface CourseListItem extends CourseKey {
  name: string;
  credit: number;
  /** 開課年級 */
  year: string;
  /** 上課節次，例如 ['101', '102']（星期 1–7 + 節次 01–15） */
  periods: string[];
  canAdd: boolean;
  label: CourseLabel;
  foreignLanguage: string;
  crossDisciplinary: boolean;
}

export interface CourseFilters {
  types: { typeNo: string; typeName: string }[];
  depts: { deptNo: string; deptName: string; typeNo: string; gradYear: number }[];
}

export interface CourseInfo extends CourseKey {
  name: string;
  englishName: string;
  teacher: string;
  /** 課程類別名稱（舊系統 sel_cos_type） */
  typeName: string;
  canAdd: boolean;
  canDrop: boolean;
  /** 課程條件說明 */
  condition: string;
  deptName: string;
  year: string;
  credit: number;
  periods: string[];
  attributes: { label: string; value: string }[];
  minStudents: number;
  maxStudents: number;
  currentStudents: number;
  memo: string;
  /** 彈窗是否顯示加選／退選按鈕（預選依課程設定，其他模式一律顯示） */
  actions: { add: boolean; drop: boolean };
}

/** 課表上的一門課 */
export interface SelectedCourse extends CourseKey {
  name: string;
  credit: number;
  periods: string[];
  label: CourseLabel;
  foreignLanguage: string;
  crossDisciplinary: boolean;
}

/** 目前課表與學分（加退選後回傳最新狀態） */
export interface SelectionState {
  courses: SelectedCourse[];
  credit: { now: number; max: number; min: number };
}

export interface EnrollRequest {
  cosId: string;
  cosClass: string;
  cosTerm: string;
}

/** API 錯誤代碼 */
export const ERROR_CODES = {
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
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** API 錯誤回應格式 */
export interface ApiError {
  code: string;
  message: string;
}

/** 前端顯示用的系統資訊（取代前端 env 檔，設定統一放在 server/.env） */
export interface AppInfo {
  title: string;
  titleSuffix: string;
  version: string;
  env: string;
  /** 每次登入可選課的秒數 */
  sessionTtlSeconds: number;
}

/** 登入頁的開放時段公告 */
export interface ScheduleItem {
  begin: string;
  end: string;
  /** 可登入的學制年級，例如「四技一年級、碩班一年級」 */
  groups: string[];
}

export interface HealthResponse {
  status: 'ok';
  env: string;
  version: string;
  time: string;
}

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

/** API 錯誤代碼 */
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  CAPTCHA_INVALID: 'CAPTCHA_INVALID',
  LOGIN_FAILED: 'LOGIN_FAILED',
  NOT_ENROLLED: 'NOT_ENROLLED',
  SYSTEM_CLOSED: 'SYSTEM_CLOSED',
  /** 尚未開放此年級、問卷未填等 */
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
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

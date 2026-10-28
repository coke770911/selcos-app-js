import {
  ERROR_CODES,
  SELCOS_MODE_NAME,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type SelcosMode,
} from '@selcos/shared';
import { AppError } from '../errors.js';
import { parseLoginAccount } from '../auth/account.js';
import type { CaptchaService } from '../auth/captcha.js';
import type { LdapAuthenticate } from '../auth/ldap.js';
import type { SessionClaims, TokenService } from '../auth/token.js';
import type { SessionService } from '../auth/session.js';
import type { AuthRepository } from '../db/repositories/authRepository.js';

export interface AuthServiceDeps {
  captcha: CaptchaService;
  ldap: LdapAuthenticate;
  repo: AuthRepository;
  sessions: SessionService;
  tokens: TokenService;
  adminAccounts: string[];
  ttlSeconds: number;
}

export interface ClientInfo {
  ip: string;
  browser: string;
}

/** sss_type → 選課模式（舊系統預設為加退選） */
function toMode(sssType: unknown): SelcosMode {
  const t = String(sssType);
  return t === '1' || t === '3' ? t : '2';
}

const loginFailed = () => new AppError(401, ERROR_CODES.LOGIN_FAILED, '帳號密碼有誤！');

export function createAuthService(deps: AuthServiceDeps) {
  return {
    async login(req: LoginRequest, client: ClientInfo): Promise<LoginResponse> {
      if (!(await deps.captcha.verify(req.captchaId, req.captcha))) {
        throw new AppError(400, ERROR_CODES.CAPTCHA_INVALID, '驗證碼錯誤！');
      }

      const account = parseLoginAccount(req.account, deps.adminAccounts);
      if (!account) throw loginFailed();
      if (!(await deps.ldap(account.ldapAccount, req.password))) throw loginFailed();
      const isAdmin = account.adminId !== undefined;

      const student = await deps.repo.findStudent(account.stdNo);
      if (!student) {
        throw new AppError(403, ERROR_CODES.NOT_ENROLLED, '找不到您的在學資料，請確認是否在學！');
      }

      // 管理員代登不受開放時段限制，方便測試流程（取代舊系統寫死的 $isAdmin = 1）
      const setting = await deps.repo.findSetting(isAdmin);
      if (!setting) throw new AppError(403, ERROR_CODES.SYSTEM_CLOSED, '選課系統目前尚未開放。');

      // TODO 階段 2：年級／延修／轉學生開放條件、問卷檢查、修課資料與學分上下限（SelectionContextService）

      const mode = toMode(setting.sss_type);
      const me: MeResponse = {
        expiresAt: new Date(Date.now() + deps.ttlSeconds * 1000).toISOString(),
        user: {
          stdNo: student.std_no.trim(),
          name: student.chi_name.trim(),
          deptNo: student.dept_no.trim(),
          deptName: student.dept_name_s.trim(),
          typeNo: String(student.type_no).trim(),
          degree: Number(student.degree),
          role: isAdmin ? 'admin' : 'user',
          adminId: account.adminId,
        },
        env: { mode, modeName: SELCOS_MODE_NAME[mode], smtr: String(setting.sss_smtr).trim() },
      };

      // 先寫登入紀錄，成功後才登記 token，避免寫入失敗時留下沒有 token 的登入
      await deps.repo.insertLoginLog({
        smtr: me.env.smtr,
        stdNo: me.user.stdNo,
        type: 'i',
        ip: client.ip,
        browser: client.browser,
        admin: account.adminId ?? 'user',
      });

      const jti = await deps.sessions.start(me.user.stdNo, me, deps.ttlSeconds);
      const claims: SessionClaims = {
        sub: me.user.stdNo,
        jti,
        role: me.user.role,
        adminId: account.adminId,
        smtr: me.env.smtr,
        mode,
      };
      const { token } = deps.tokens.sign(claims);

      return { token, ...me };
    },

    async logout(claims: SessionClaims, client: ClientInfo): Promise<void> {
      await deps.sessions.end(claims.sub, claims.jti);
      await deps.repo.insertLoginLog({
        smtr: claims.smtr,
        stdNo: claims.sub,
        type: 'f',
        ip: client.ip,
        browser: client.browser,
        admin: claims.adminId ?? 'user',
      });
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

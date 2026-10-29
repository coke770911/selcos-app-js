import { ERROR_CODES, SELCOS_MODE_NAME } from '@selcos/shared';
import { AppError } from '../errors.js';
import { parseLoginAccount } from '../auth/account.js';

import { buildSelectionContext } from './selectionContext.js';

/**
 * @import { LoginRequest, LoginResponse, MeResponse, SelcosMode } from '@selcos/shared'
 * @import { CaptchaService } from '../auth/captcha.js'
 * @import { LdapAuthenticate } from '../auth/ldap.js'
 * @import { SessionClaims, TokenService } from '../auth/token.js'
 * @import { SessionService } from '../auth/session.js'
 * @import { AuthRepository } from '../db/repositories/authRepository.js'
 * @import { SelectionContextRepository } from '../db/repositories/selectionContextRepository.js'
 * @import { SelectionContextStore } from './selectionContext.js'
 */

/**
 * @typedef {object} AuthServiceDeps
 * @property {CaptchaService} captcha
 * @property {LdapAuthenticate} ldap
 * @property {AuthRepository} repo
 * @property {SelectionContextRepository} contextRepo
 * @property {SelectionContextStore} contexts
 * @property {SessionService} sessions
 * @property {TokenService} tokens
 * @property {string[]} adminAccounts
 * @property {number} ttlSeconds
 */

/**
 * @typedef {object} ClientInfo
 * @property {string} ip
 * @property {string} browser
 */

/**
 * sss_type → 選課模式（舊系統預設為加退選）
 * @param {unknown} sssType
 * @returns {SelcosMode}
 */
function toMode(sssType) {
  const t = String(sssType);
  return t === '1' || t === '3' ? t : '2';
}

const loginFailed = () => new AppError(401, ERROR_CODES.LOGIN_FAILED, '帳號密碼有誤！');

/** @param {AuthServiceDeps} deps */
export function createAuthService(deps) {
  return {
    /**
     * @param {LoginRequest} req
     * @param {ClientInfo} client
     * @returns {Promise<LoginResponse>}
     */
    async login(req, client) {
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

      const mode = toMode(setting.sss_type);

      // 年級／延修／轉學生開放條件、問卷、修課資料、學分上下限（舊系統 process.php 後半段）
      const built = await buildSelectionContext({
        repo: deps.contextRepo,
        student,
        setting,
        mode,
        isAdmin,
      });
      if (!built.ok) throw new AppError(403, ERROR_CODES.NOT_ELIGIBLE, built.message);
      const { context } = built;

      /** @type {MeResponse} */
      const me = {
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
          currentDegree: context.currentDegree,
        },
        env: { mode, modeName: SELCOS_MODE_NAME[mode], smtr: context.smtr },
        credit: context.credit,
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

      await deps.contexts.save(context, deps.ttlSeconds);
      const jti = await deps.sessions.start(me.user.stdNo, me, deps.ttlSeconds);
      /** @type {SessionClaims} */
      const claims = {
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

    /**
     * @param {SessionClaims} claims
     * @param {ClientInfo} client
     * @returns {Promise<void>}
     */
    async logout(claims, client) {
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

/** @typedef {ReturnType<typeof createAuthService>} AuthService */

import { createMemoryCache } from '../src/cache/memoryCache.js';
import { createCaptchaService } from '../src/auth/captcha.js';
import { createSessionService } from '../src/auth/session.js';
import { createTokenService } from '../src/auth/token.js';
import type { LdapAuthenticate } from '../src/auth/ldap.js';
import type {
  AuthRepository,
  LoginLog,
  SelcosSettingRow,
  StudentRow,
} from '../src/db/repositories/authRepository.js';
import { createAuthService } from '../src/services/authService.js';
import type { AppDeps } from '../src/container.js';

export const STUDENT: StudentRow = {
  std_no: '112A0001  ',
  chi_name: '王小明',
  type_no: '4',
  degree: '2',
  class: 'A',
  state: '01',
  std_type: '0',
  team: '0',
  dept_no: '4IM',
  entry_year: '112',
  Academic_year: '112',
  dept_name_s: '資管系',
  grad_year: '4',
};

export const SETTING: SelcosSettingRow = {
  sss_type: '2',
  sss_smtr: '1142',
  sss_state: true,
  sss_beginTime: new Date(),
  sss_endTime: new Date(),
};

/** 假的 AD：密碼為 "pw" 才通過 */
export const fakeLdap: LdapAuthenticate = async (_account, password) => password === 'pw';

export function fakeRepo(overrides: Partial<AuthRepository> = {}) {
  const logs: LoginLog[] = [];
  const repo: AuthRepository = {
    findStudent: async (stdNo) => (stdNo === '112A0001' ? STUDENT : null),
    findSetting: async () => SETTING,
    insertLoginLog: async (log) => {
      logs.push(log);
    },
    ...overrides,
  };
  return { repo, logs };
}

export function makeDeps(repoOverrides: Partial<AuthRepository> = {}) {
  const cache = createMemoryCache();
  const captcha = createCaptchaService(cache);
  const sessions = createSessionService(cache);
  const tokens = createTokenService('unit-test-secret-unit-test-secret-1234', 1800);
  const { repo, logs } = fakeRepo(repoOverrides);
  const auth = createAuthService({
    captcha,
    ldap: fakeLdap,
    repo,
    sessions,
    tokens,
    adminAccounts: ['fz083'],
    ttlSeconds: 1800,
  });
  const deps: AppDeps = {
    publicRepo: { findSchedule: async () => [] },
    cache,
    captcha,
    sessions,
    tokens,
    auth,
  };

  /** 產生一張驗證碼並回傳正確答案（測試直接讀快取） */
  const solveCaptcha = async () => {
    const { captchaId } = await captcha.create();
    const answer = (await cache.get<string>(`captcha:${captchaId}`))!;
    return { captchaId, captcha: answer };
  };

  return { deps, logs, solveCaptcha };
}

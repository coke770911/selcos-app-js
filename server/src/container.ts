import { env } from './config/env.js';
import { createCache, type CacheStore } from './cache/index.js';
import { createCaptchaService, type CaptchaService } from './auth/captcha.js';
import { ldapAuthenticate } from './auth/ldap.js';
import { createSessionService, type SessionService } from './auth/session.js';
import { createTokenService, type TokenService } from './auth/token.js';
import { authRepository } from './db/repositories/authRepository.js';
import { courseRepository } from './db/repositories/courseRepository.js';
import { publicRepository, type PublicRepository } from './db/repositories/publicRepository.js';
import { selectionContextRepository } from './db/repositories/selectionContextRepository.js';
import { createAuthService, type AuthService } from './services/authService.js';
import { createCourseService, type CourseService } from './services/courseService.js';
import { enrollmentRepository } from './db/repositories/enrollmentRepository.js';
import { createEnrollmentService, type EnrollmentService } from './services/enrollmentService.js';
import { createSelectionContextStore } from './services/selectionContext.js';

export interface AppDeps {
  publicRepo: PublicRepository;
  cache: CacheStore;
  captcha: CaptchaService;
  sessions: SessionService;
  tokens: TokenService;
  auth: AuthService;
  courses: CourseService;
  enrollment: EnrollmentService;
}

/** 正式執行用的相依物件；測試時改用假的 repo / ldap 自行組裝 */
export function createDeps(): AppDeps {
  const cache = createCache();
  const captcha = createCaptchaService(cache);
  const sessions = createSessionService(cache);
  const tokens = createTokenService(env.JWT_SECRET, env.SESSION_TTL_SECONDS);
  const contexts = createSelectionContextStore(cache);
  const auth = createAuthService({
    captcha,
    ldap: ldapAuthenticate,
    repo: authRepository,
    contextRepo: selectionContextRepository,
    contexts,
    sessions,
    tokens,
    adminAccounts: env.ADMIN_ACCOUNTS,
    ttlSeconds: env.SESSION_TTL_SECONDS,
  });
  const courses = createCourseService({ repo: courseRepository, contexts });
  const enrollment = createEnrollmentService({ repo: enrollmentRepository, contexts });
  return {
    publicRepo: publicRepository,
    cache,
    captcha,
    sessions,
    tokens,
    auth,
    courses,
    enrollment,
  };
}

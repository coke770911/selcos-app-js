import { env } from './config/env.js';
import { createCache } from './cache/index.js';
import { createCaptchaService } from './auth/captcha.js';
import { ldapAuthenticate } from './auth/ldap.js';
import { createSessionService } from './auth/session.js';
import { createTokenService } from './auth/token.js';
import { authRepository } from './db/repositories/authRepository.js';
import { courseRepository } from './db/repositories/courseRepository.js';
import { publicRepository } from './db/repositories/publicRepository.js';
import { selectionContextRepository } from './db/repositories/selectionContextRepository.js';
import { createAuthService } from './services/authService.js';
import { createCourseService } from './services/courseService.js';
import { enrollmentRepository } from './db/repositories/enrollmentRepository.js';
import { createEnrollmentService } from './services/enrollmentService.js';
import { createSelectionContextStore } from './services/selectionContext.js';

/**
 * @import { CacheStore } from './cache/CacheStore.js'
 * @import { CaptchaService } from './auth/captcha.js'
 * @import { SessionService } from './auth/session.js'
 * @import { TokenService } from './auth/token.js'
 * @import { PublicRepository } from './db/repositories/publicRepository.js'
 * @import { AuthService } from './services/authService.js'
 * @import { CourseService } from './services/courseService.js'
 * @import { EnrollmentService } from './services/enrollmentService.js'
 */

/**
 * @typedef {object} AppDeps
 * @property {PublicRepository} publicRepo
 * @property {CacheStore} cache
 * @property {CaptchaService} captcha
 * @property {SessionService} sessions
 * @property {TokenService} tokens
 * @property {AuthService} auth
 * @property {CourseService} courses
 * @property {EnrollmentService} enrollment
 */

/**
 * 正式執行用的相依物件；測試時改用假的 repo / ldap 自行組裝
 * @returns {AppDeps}
 */
export function createDeps() {
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

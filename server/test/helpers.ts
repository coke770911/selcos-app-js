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
import type { SelectionContextRepository } from '../src/db/repositories/selectionContextRepository.js';
import { createAuthService } from '../src/services/authService.js';
import { createSelectionContextStore } from '../src/services/selectionContext.js';
import { createCourseService } from '../src/services/courseService.js';
import type { CourseRepository, CourseRow } from '../src/db/repositories/courseRepository.js';
import type {
  CourseKeyParams,
  EnrollCourseRow,
  EnrollmentRepository,
  EnrollmentTx,
  SelectedRow,
} from '../src/db/repositories/enrollmentRepository.js';
import { createEnrollmentService } from '../src/services/enrollmentService.js';
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

// 階段 2 起登入會檢查開放條件：假時段需開放 STUDENT 的年級（2 年級）
export const SETTING: SelcosSettingRow = {
  sss_type: '2',
  sss_smtr: '1142',
  sss_state: true,
  sss_beginTime: new Date(),
  sss_endTime: new Date(),
  sss_2degree: 'Y',
  chk_question: 'N',
};

/** 假的選課前置資料：一般在學生，無修課紀錄，學分 25／15 */
export const fakeContextRepo: SelectionContextRepository = {
  findCourseRecords: async () => [],
  findCreditLimit: async () => ({ max_credit: 25, min_credit: 15 }),
  findMustCourses: async () => [],
  hasQuestionnaire: async () => true,
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

/** 假的學期開課資料（1142 學期） */
export function courseRow(overrides: Partial<CourseRow> = {}): CourseRow {
  return {
    cos_smtr: '1142',
    cos_id: '4IM1001',
    cos_class: 'A',
    cos_term: '1',
    cos_year: '2',
    cos_sel_type: 'C',
    cos_credit: 3,
    cos_cname: '程式設計',
    cos_ename: 'PROGRAMMING',
    schd_time: '101,102',
    chk_can_ins: 'Y',
    chk_can_del: 'N',
    chk_college: 'N',
    chk_dept: 'Y',
    chk_selcos_dept: 'N',
    teacher_name: '王老師',
    dept_name: '資管系',
    max_std: 50,
    min_std: 15,
    memo: '',
    att_foreignLanguage: '無',
    att_internship: '否',
    att_module: '無',
    att_courseOfStudy: '無',
    att_distanceLearning: '否',
    att_licenseProgram: '否',
    att_cooperativeEducation: '否',
    att_specPoint: '無',
    cos_crossDisciplinary: '0',
    sel_total: 20,
    ...overrides,
  };
}

/** 假的課程查詢：記錄呼叫參數，方便檢查學期是否取自登入資料 */
export function fakeCourseRepo(rows: CourseRow[] = [courseRow()]) {
  const calls: unknown[][] = [];
  const repo: CourseRepository = {
    findTypes: async () => [{ type_no: '4', type_name: '國際產學專班' }],
    findDepts: async (smtr) => {
      calls.push(['findDepts', smtr]);
      return [{ dept_no: '4IM ', dept_name_s: '資管系', grad_year: 4, dept_type_no: '4' }];
    },
    findByDept: async (...args) => {
      calls.push(['findByDept', ...args]);
      return rows;
    },
    findByPeriod: async (...args) => {
      calls.push(['findByPeriod', ...args]);
      return rows;
    },
    findInfo: async (...args) => {
      calls.push(['findInfo', ...args]);
      return rows.find((r) => r.cos_id === args[1]) ?? null;
    },
  };
  return { repo, calls };
}

/** 加選用的完整課程資料（sel_total 為基本人數，會再加上假選課資料） */
export function enrollCourse(overrides: Partial<EnrollCourseRow> = {}): EnrollCourseRow {
  return {
    ...courseRow(),
    cos_dept_no: '4IM',
    cos_dept: '4IM',
    chk_max_num: 'Y',
    chk_min_num: 'Y',
    chk_over_year: '0',
    chk_under_year: '9',
    sel_total: 0,
    chk_can_del: 'Y',
    ...overrides,
  };
}

const sameKey = (a: CourseKeyParams, b: { cos_id: string; cos_class: string; cos_term: string }) =>
  a.cosId === b.cos_id && a.cosClass === b.cos_class && a.cosTerm === b.cos_term;

/**
 * 記憶體版加退選資料：withLocks 依序執行（模擬資料庫鎖），用來測試同時加選不會超收。
 */
export function fakeEnrollmentRepo(courses: EnrollCourseRow[] = [enrollCourse()]) {
  const regs: (CourseKeyParams & { stdNo: string; selType: string })[] = [];
  const locks: string[][] = [];
  let queue: Promise<unknown> = Promise.resolve();

  const count = (k: CourseKeyParams) =>
    regs.filter((r) => r.cosId === k.cosId && r.cosClass === k.cosClass && r.cosTerm === k.cosTerm)
      .length;
  const findSelected = async (smtr: string, stdNo: string): Promise<SelectedRow[]> =>
    regs
      .filter((r) => r.stdNo === stdNo && r.smtr === smtr)
      .map((r) => {
        const c = courses.find((x) => sameKey(r, x))!;
        return {
          sel_smtr: r.smtr,
          sel_cos_id: r.cosId,
          sel_cos_class: r.cosClass,
          sel_cos_term: r.cosTerm,
          sel_cos_type: r.selType,
          cos_cname: c.cos_cname,
          cos_credit: c.cos_credit,
          schd_time: c.schd_time,
          att_foreignLanguage: c.att_foreignLanguage,
          cos_crossDisciplinary: c.cos_crossDisciplinary ?? '0',
        };
      });

  const tx: EnrollmentTx = {
    findCourse: async (k) => {
      const c = courses.find((x) => x.cos_smtr === k.smtr && sameKey(k, x));
      return c ? { ...c, sel_total: c.sel_total + count(k) } : null;
    },
    findSelected,
    findMoreDept: async () => [],
    findClashCosIds: async () => [],
    insert: async (k) => {
      // 讓出執行權，模擬資料庫延遲，確保真的有交錯的機會
      await new Promise((r) => setTimeout(r, 5));
      regs.push(k);
    },
    remove: async (k) => {
      const i = regs.findIndex(
        (r) =>
          r.stdNo === k.stdNo &&
          r.cosId === k.cosId &&
          r.cosClass === k.cosClass &&
          r.cosTerm === k.cosTerm,
      );
      if (i >= 0) regs.splice(i, 1);
    },
  };

  const repo: EnrollmentRepository = {
    withLocks(resources, fn) {
      locks.push(resources);
      const run = queue.then(() => fn(tx));
      queue = run.catch(() => undefined);
      return run;
    },
    findSelected,
  };
  return { repo, regs, locks };
}

export function makeDeps(
  repoOverrides: Partial<AuthRepository> = {},
  courseRepo: CourseRepository = fakeCourseRepo().repo,
  enrollmentRepo: EnrollmentRepository = fakeEnrollmentRepo().repo,
) {
  const cache = createMemoryCache();
  const captcha = createCaptchaService(cache);
  const sessions = createSessionService(cache);
  const tokens = createTokenService('unit-test-secret-unit-test-secret-1234', 1800);
  const contexts = createSelectionContextStore(cache);
  const { repo, logs } = fakeRepo(repoOverrides);
  const auth = createAuthService({
    captcha,
    ldap: fakeLdap,
    repo,
    contextRepo: fakeContextRepo,
    contexts,
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
    courses: createCourseService({ repo: courseRepo, contexts }),
    enrollment: createEnrollmentService({ repo: enrollmentRepo, contexts }),
  };

  /** 產生一張驗證碼並回傳正確答案（測試直接讀快取） */
  const solveCaptcha = async () => {
    const { captchaId } = await captcha.create();
    const answer = (await cache.get<string>(`captcha:${captchaId}`))!;
    return { captchaId, captcha: answer };
  };

  return { deps, logs, solveCaptcha };
}

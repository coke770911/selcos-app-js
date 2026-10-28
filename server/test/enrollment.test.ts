import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import {
  enrollCourse,
  fakeCourseRepo,
  fakeEnrollmentRepo,
  makeDeps,
  SETTING,
  STUDENT,
} from './helpers.js';

const A = { cosId: '4IM1001', cosClass: 'A', cosTerm: '1' };
/** 15 學分、不衝堂的課：先選它，退選 A 時才不會低於學分下限 15 */
const BIG = { cosId: '4IM9000', cosClass: 'A', cosTerm: '1' };
const bigCourse = () => enrollCourse({ cos_id: '4IM9000', cos_credit: 15, schd_time: '501' });

async function setup(courses = [enrollCourse()]) {
  const enroll = fakeEnrollmentRepo(courses);
  const ctx = makeDeps(
    // 任何 112A 開頭的學號都視為在學，方便測試多位學生；時段開啟人數上下限檢查
    {
      findStudent: async (stdNo) =>
        stdNo.startsWith('112A') ? { ...STUDENT, std_no: stdNo } : null,
      findSetting: async () => ({
        ...SETTING,
        chk_sel_stdnum_max: 'Y',
        chk_sel_stdnum_min: 'Y',
      }),
    },
    fakeCourseRepo().repo,
    enroll.repo,
  );
  const app = createApp(ctx.deps, { webDir: false });
  const login = async (stdNo = '112A0001') => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ account: stdNo, password: 'pw', ...(await ctx.solveCaptcha()) });
    const token = res.body.token as string;
    return {
      add: (body: object) =>
        request(app).post('/api/selection').auth(token, { type: 'bearer' }).send(body),
      drop: (k: typeof A) =>
        request(app)
          .delete(`/api/selection/${k.cosId}/${k.cosClass}/${k.cosTerm}`)
          .auth(token, { type: 'bearer' }),
      state: () => request(app).get('/api/selection').auth(token, { type: 'bearer' }),
    };
  };
  return { login, enroll };
}

describe('加退選 API', () => {
  it('加選成功回傳最新課表與學分，並依序鎖定學生、課程', async () => {
    const { login, enroll } = await setup();
    const s = await login();
    const res = await s.add(A);
    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
    expect(res.body.courses[0]).toMatchObject({ cosId: '4IM1001', periods: ['101', '102'] });
    expect(res.body.credit).toEqual({ now: 3, max: 25, min: 15 });
    expect(enroll.locks[0]).toEqual(['selcos:std:112A0001', 'selcos:cos:1142:4IM1001:A:1']);
    expect((await s.state()).body.credit.now).toBe(3);
  });

  it('規則不通過回 409 ENROLL_REJECTED 與舊系統訊息，且未寫入', async () => {
    const { login, enroll } = await setup();
    const s = await login();
    await s.add(A);
    const again = await s.add(A);
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ code: 'ENROLL_REJECTED', message: '您這學期課表已選過此課程！' });
    expect(enroll.regs).toHaveLength(1);
  });

  it('衝堂', async () => {
    const { login } = await setup([
      enrollCourse(),
      enrollCourse({ cos_id: '4IM1002', schd_time: '102,103' }),
    ]);
    const s = await login();
    await s.add(A);
    const res = await s.add({ ...A, cosId: '4IM1002' });
    expect(res.body.message).toBe('此課程與您目前課表衝堂！');
  });

  it('查無課程', async () => {
    const { login } = await setup();
    const res = await (await login()).add({ ...A, cosId: 'NOPE' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('查無此課程資料，請試試看重新整理網頁！');
  });

  it('同時搶最後一個名額：只有一位成功，不會超收', async () => {
    const { login, enroll } = await setup([enrollCourse({ max_std: 1 })]);
    const students = await Promise.all(['112A0001', '112A0002', '112A0003'].map((s) => login(s)));
    const results = await Promise.all(students.map((s) => s.add(A)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(
      results.filter((r) => r.body.message === '此課程人數已達上限，不可再加選！'),
    ).toHaveLength(2);
    expect(enroll.regs).toHaveLength(1);
  });

  it('同一位學生同時加選兩門衝堂的課：只會成功一門', async () => {
    const { login, enroll } = await setup([
      enrollCourse(),
      enrollCourse({ cos_id: '4IM1002', schd_time: '102' }),
    ]);
    const s = await login();
    const results = await Promise.all([s.add(A), s.add({ ...A, cosId: '4IM1002' })]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(enroll.regs).toHaveLength(1);
  });

  it('退選成功；不在課表中的課不可退', async () => {
    const { login, enroll } = await setup([enrollCourse({ sel_total: 30 }), bigCourse()]);
    const s = await login();
    expect((await s.drop(A)).body.message).toBe('此課程不在您的課表中，請重新整理網頁！');
    await s.add(BIG);
    await s.add(A);
    const res = await s.drop(A);
    expect(res.status).toBe(200);
    expect(res.body.courses.map((c: { cosId: string }) => c.cosId)).toEqual(['4IM9000']);
    expect(res.body.credit.now).toBe(15);
    expect(enroll.regs.some((r) => r.cosId === A.cosId)).toBe(false);
  });

  it('退選不可低於人數下限', async () => {
    const { login } = await setup([enrollCourse({ sel_total: 14, min_std: 15 }), bigCourse()]);
    const s = await login();
    await s.add(BIG);
    await s.add(A);
    expect((await s.drop(A)).body.message).toBe('此課程人數低於下限，不可退選。');
  });

  it('需要登入；格式錯誤回 400', async () => {
    const { login } = await setup();
    const s = await login();
    expect((await s.add({ cosId: '' })).status).toBe(400);
  });
});

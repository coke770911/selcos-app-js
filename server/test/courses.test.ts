import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { courseActions, courseCondition, toInfo } from '../src/services/courseService.js';
import { courseRow, fakeCourseRepo, makeDeps } from './helpers.js';

async function setup(rows = [courseRow()]) {
  const course = fakeCourseRepo(rows);
  const ctx = makeDeps({}, course.repo);
  const app = createApp(ctx.deps, { webDir: false });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ account: '112A0001', password: 'pw', ...(await ctx.solveCaptcha()) });
  const token = res.body.token as string;
  const get = (url: string) => request(app).get(url).auth(token, { type: 'bearer' });
  return { app, get, calls: course.calls, deps: ctx.deps };
}

describe('課程 API', () => {
  it('需要登入', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/courses/filters')).status).toBe(401);
  });

  it('查詢選單：學制與本學期系所（學期取自登入資料）', async () => {
    const { get, calls } = await setup();
    const res = await get('/api/courses/filters');
    expect(res.body).toEqual({
      types: [{ typeNo: '4', typeName: '國際產學專班' }],
      depts: [{ deptNo: '4IM', deptName: '資管系', typeNo: '4', gradYear: 4 }],
    });
    expect(calls).toContainEqual(['findDepts', '1142']);
  });

  it('依系所、依節次查課，回傳節次陣列與類別標示', async () => {
    const { get, calls } = await setup();
    const byDept = await get('/api/courses?mode=dept&deptNo=4IM&year=2');
    expect(byDept.body[0]).toMatchObject({
      cosId: '4IM1001',
      periods: ['101', '102'],
      label: { kind: 'required', typeName: '專業必修', tag: '[必修]' },
    });
    expect(calls).toContainEqual(['findByDept', '1142', '4IM', '2']);

    await get('/api/courses?mode=time&weekday=3&period=05');
    expect(calls).toContainEqual(['findByPeriod', '1142', '3', '05']);
  });

  it('查詢條件格式錯誤回 400', async () => {
    const { get } = await setup();
    expect((await get('/api/courses?mode=time&weekday=8&period=05')).status).toBe(400);
    expect((await get('/api/courses?mode=dept&deptNo=4IM&year=ab')).status).toBe(400);
    expect((await get('/api/courses?mode=other')).status).toBe(400);
  });

  it('課程資訊：學期取自登入資料；查無課程回 404', async () => {
    const { get, calls } = await setup();
    const res = await get('/api/courses/4IM1001/A/1');
    expect(res.body).toMatchObject({
      cosId: '4IM1001',
      currentStudents: 20,
      condition: '同系可加選',
    });
    expect(calls).toContainEqual(['findInfo', '1142', '4IM1001', 'A', '1']);
    expect((await get('/api/courses/NOPE/A/1')).status).toBe(404);
  });

  it('選課前置資料已過期時回 SESSION_EXPIRED', async () => {
    const { get, deps } = await setup();
    await deps.cache.del('context:112A0001');
    const res = await get('/api/courses/filters');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
  });
});

describe('課程資訊規則（舊系統 selcos_cos_info.php）', () => {
  it('課程條件依跨學制 → 同系 → 指定系所的順序', () => {
    const r = { chk_college: 'N', chk_dept: 'N', chk_selcos_dept: 'N' };
    expect(courseCondition({ ...r, chk_college: 'Y', chk_dept: 'Y' })).toBe('同學制可跨系選修');
    expect(courseCondition({ ...r, chk_dept: 'Y' })).toBe('同系可加選');
    expect(courseCondition({ ...r, chk_selcos_dept: 'Y' })).toBe('需檢查系所');
    expect(courseCondition(r)).toBe('不需檢查選課條件');
  });

  it('預選依課程可加選／可退選顯示按鈕，其他模式一律顯示', () => {
    expect(courseActions({ chk_can_ins: 'Y', chk_can_del: 'N' }, '1')).toEqual({
      add: true,
      drop: false,
    });
    expect(courseActions({ chk_can_ins: 'N', chk_can_del: 'N' }, '2')).toEqual({
      add: true,
      drop: true,
    });
  });

  it('類別名稱沿用 sel_cos_type，備註空白顯示「無」', () => {
    const info = toInfo(courseRow({ cos_sel_type: 'P', memo: null }), '2');
    expect(info.typeName).toBe('核心通識');
    expect(info.memo).toBe('無');
    expect(info.attributes).toHaveLength(8);
  });
});

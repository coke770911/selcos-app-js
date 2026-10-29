import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeDeps, SETTING } from './helpers.js';

function setup(repoOverrides = {}) {
  const ctx = makeDeps(repoOverrides);
  const app = createApp(ctx.deps, { webDir: false });
  const login = async (account = '112a0001', password = 'pw') =>
    request(app)
      .post('/api/auth/login')
      .send({ account, password, ...(await ctx.solveCaptcha()) });
  return { ...ctx, app, login };
}

describe('驗證碼', () => {
  it('回傳 SVG 與 id，且不快取', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/auth/captcha');
    expect(res.status).toBe(200);
    expect(res.body.captchaId).toBeTruthy();
    expect(res.body.svg).toMatch(/^<svg/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('答錯或重複使用都拒絕', async () => {
    const { app, solveCaptcha } = setup();
    const c = await solveCaptcha();
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ account: '112A0001', password: 'pw', captchaId: c.captchaId, captcha: '0000x' });
    expect(wrong.body.code).toBe('CAPTCHA_INVALID');
    // 答錯後同一張就作廢，答對也不能再用
    const reuse = await request(app)
      .post('/api/auth/login')
      .send({ account: '112A0001', password: 'pw', ...c });
    expect(reuse.body.code).toBe('CAPTCHA_INVALID');
  });
});

describe('登入', () => {
  it('學生登入成功，回傳 token、學籍與選課模式，並寫登入紀錄', async () => {
    const { login, logs } = setup();
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ stdNo: '112A0001', name: '王小明', role: 'user' });
    expect(res.body.env).toEqual({ mode: '2', modeName: '加退選', smtr: '1142' });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'i', stdNo: '112A0001', admin: 'user', smtr: '1142' });
  });

  it('管理員代登：role 為 admin，紀錄寫管理員帳號，且不受開放時段限制', async () => {
    /** @type {boolean[]} */
    const calls = [];
    const { login, logs } = setup({
      /** @param {boolean} ignoreSchedule */
      findSetting: async (ignoreSchedule) => {
        calls.push(ignoreSchedule);
        return SETTING;
      },
    });
    const res = await login('112A0001/FZ083');
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'admin', adminId: 'fz083' });
    expect(calls).toEqual([true]);
    expect(logs[0]?.admin).toBe('fz083');
  });

  it('密碼錯誤、空密碼、未授權的代登都回傳相同訊息', async () => {
    const { login } = setup();
    for (const [account, password] of [
      ['112A0001', 'bad'],
      ['112A0001/someone', 'pw'],
    ]) {
      const res = await login(account, password);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ code: 'LOGIN_FAILED', message: '帳號密碼有誤！' });
    }
    const empty = await login('112A0001', '');
    expect(empty.status).toBe(400);
  });

  it('登入紀錄寫入失敗時回傳錯誤，且不留下登入', async () => {
    const { app, login } = setup({
      insertLoginLog: async () => {
        throw new Error('db down');
      },
    });
    expect((await login()).status).toBe(500);
    expect((await request(app).get('/api/public/online')).body.count).toBe(0);
  });

  it('非在學、未開放時段', async () => {
    expect((await setup().login('999')).body.code).toBe('NOT_ENROLLED');
    const closed = setup({ findSetting: async () => null });
    expect((await closed.login()).body.code).toBe('SYSTEM_CLOSED');
  });

  it('同一帳號 5 分鐘內超過 10 次會被限制', async () => {
    const { login } = setup();
    for (let i = 0; i < 10; i++) await login('112A0001', 'bad');
    const res = await login('112A0001', 'pw');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('token 與單一登入', () => {
  it('/me 需要有效 token', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc');
    expect(bad.body.code).toBe('UNAUTHORIZED');
  });

  it('再次登入會讓舊 token 失效', async () => {
    const { app, login } = setup();
    const first = (await login()).body.token;
    expect((await request(app).get('/api/auth/me').auth(first, { type: 'bearer' })).status).toBe(
      200,
    );

    const second = (await login()).body.token;
    const old = await request(app).get('/api/auth/me').auth(first, { type: 'bearer' });
    expect(old.status).toBe(401);
    expect(old.body.code).toBe('SESSION_REPLACED');
    const now = await request(app).get('/api/auth/me').auth(second, { type: 'bearer' });
    expect(now.body.user.stdNo).toBe('112A0001');
  });

  it('登出後 token 失效、寫登出紀錄、線上人數減少', async () => {
    const { app, login, logs } = setup();
    const token = (await login()).body.token;
    expect((await request(app).get('/api/public/online')).body.count).toBe(1);

    const out = await request(app).post('/api/auth/logout').auth(token, { type: 'bearer' });
    expect(out.status).toBe(204);
    expect(logs.at(-1)).toMatchObject({ type: 'f', stdNo: '112A0001' });
    expect((await request(app).get('/api/auth/me').auth(token, { type: 'bearer' })).status).toBe(
      401,
    );
    expect((await request(app).get('/api/public/online')).body.count).toBe(0);
  });
});

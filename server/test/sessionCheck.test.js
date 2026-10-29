import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeDeps } from './helpers.js';

function setup() {
  const ctx = makeDeps();
  const app = createApp(ctx.deps, { webDir: false });
  const login = async () =>
    (
      await request(app)
        .post('/api/auth/login')
        .send({ account: '112A0001', password: 'pw', ...(await ctx.solveCaptcha()) })
    ).body.token;
  /** @param {string} token */
  const check = (token) => request(app).get('/api/auth/check').auth(token, { type: 'bearer' });
  return { app, login, check };
}

describe('登入狀態確認（即時通知被踢下線）', () => {
  it('有效時回 204 且不快取', async () => {
    const { login, check } = setup();
    const res = await check(await login());
    expect(res.status).toBe(204);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('被其他登入取代時回 SESSION_REPLACED，並說明是在其他地方登入', async () => {
    const { login, check } = setup();
    const first = await login();
    await login();
    const res = await check(first);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_REPLACED');
    expect(res.body.message).toContain('其他地方登入');
  });

  it('登出後回 SESSION_EXPIRED（與被取代區分）', async () => {
    const { app, login, check } = setup();
    const token = await login();
    await request(app).post('/api/auth/logout').auth(token, { type: 'bearer' });
    const res = await check(token);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
  });
});

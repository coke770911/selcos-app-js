import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeDeps, SETTING } from './helpers.js';

function setup(repoOverrides = {}) {
  const ctx = makeDeps(repoOverrides);
  const app = createApp(ctx.deps, { webDir: false });
  const login = async (account = '112A0001') =>
    request(app)
      .post('/api/auth/login')
      .send({ account, password: 'pw', ...(await ctx.solveCaptcha()) });
  return { ...ctx, app, login };
}

describe('登入時建立選課前置資料（階段 2）', () => {
  it('回傳學分上下限與選課年級，並存入共用快取', async () => {
    const { login, deps } = setup();
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.credit).toEqual({ max: 25, min: 15 });
    expect(res.body.user.currentDegree).toBe(2);
    const saved = await deps.cache.get('context:112A0001');
    expect(saved?.stdNo).toBe('112A0001');
  });

  it('年級未開放時回傳 NOT_ELIGIBLE 與舊系統訊息，且不寫登入紀錄', async () => {
    const { login, logs } = setup({
      findSetting: async () => ({ ...SETTING, sss_2degree: 'N' }),
    });
    const res = await login();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      code: 'NOT_ELIGIBLE',
      message: '尚未開放您的系別年級選課，詳細請查閱教務處選課時間公告！',
    });
    expect(logs).toHaveLength(0);
  });

  it('管理員代登不受年級開放限制', async () => {
    const { login } = setup({
      findSetting: async () => ({ ...SETTING, sss_2degree: 'N' }),
    });
    expect((await login('112A0001/fz083')).status).toBe(200);
  });
});

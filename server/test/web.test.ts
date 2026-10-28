import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { makeDeps } from './helpers.js';

function webApp() {
  const dir = mkdtempSync(path.join(tmpdir(), 'selcos-web-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="app"></div>');
  writeFileSync(path.join(dir, 'assets', 'index-abc.js'), 'console.log(1)');
  return createApp(makeDeps().deps, { webDir: dir });
}

describe('由後端提供前端畫面', () => {
  it('前端路由一律回傳 index.html，且不長期快取', async () => {
    const app = webApp();
    for (const url of ['/', '/login', '/selection']) {
      const res = await request(app).get(url);
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="app"');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('打包資源可長期快取', async () => {
    const res = await request(webApp()).get('/assets/index-abc.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('不存在的 API 仍回 JSON 404，不會回傳 index.html', async () => {
    const res = await request(webApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('沒有打包結果時不提供前端', async () => {
    const app = createApp(makeDeps().deps, { webDir: path.join(tmpdir(), 'selcos-no-such-dir') });
    expect((await request(app).get('/login')).status).toBe(404);
  });
});

import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { APP_VERSION } from '../src/config/version.js';
import { makeDeps } from './helpers.js';

const rootVersion = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

describe('系統版本號', () => {
  it('取自根目錄 package.json，格式為 主.次.修訂', () => {
    expect(APP_VERSION).toBe(rootVersion);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('health 與 app-info 回傳相同版本', async () => {
    const app = createApp(makeDeps().deps, { webDir: false });
    expect((await request(app).get('/api/health')).body.version).toBe(rootVersion);
    expect((await request(app).get('/api/public/app-info')).body.version).toBe(rootVersion);
  });
});

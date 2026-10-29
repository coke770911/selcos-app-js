import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEnvFile } from '../src/config/loadEnv.js';

const keys = ['SELCOS_T_A', 'SELCOS_T_B'];

afterEach(() => {
  for (const k of keys) delete process.env[k];
});

describe('loadEnvFile', () => {
  it('讀取 .env，且不覆寫已存在的環境變數', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'selcos-env-'));
    writeFileSync(path.join(dir, '.env'), 'SELCOS_T_A=file\nSELCOS_T_B=file\n');
    process.env.SELCOS_T_B = 'process';

    expect(loadEnvFile(dir)).toBe(true);
    expect(process.env.SELCOS_T_A).toBe('file');
    expect(process.env.SELCOS_T_B).toBe('process');
  });

  it('沒有 .env 時回傳 false', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'selcos-env-'));
    expect(loadEnvFile(dir)).toBe(false);
  });
});

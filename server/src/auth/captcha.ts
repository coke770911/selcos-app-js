import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import type * as SvgCaptcha from 'svg-captcha';
import type { CaptchaResponse } from '@selcos/shared';
import type { CacheStore } from '../cache/CacheStore.js';

// svg-captcha 是 CommonJS 套件
const svgCaptcha = createRequire(import.meta.url)('svg-captcha') as typeof SvgCaptcha;

export const CAPTCHA_TTL_SECONDS = 120;
const key = (id: string) => `captcha:${id}`;

export interface CaptchaService {
  create(): Promise<CaptchaResponse>;
  /** 驗證後一律作廢（不論對錯），避免同一張驗證碼被重複嘗試 */
  verify(captchaId: string, answer: string): Promise<boolean>;
}

export function createCaptchaService(cache: CacheStore): CaptchaService {
  return {
    async create() {
      // 與舊系統相同：4 位數字
      const { text, data } = svgCaptcha.create({
        size: 4,
        charPreset: '0123456789',
        noise: 2,
        color: true,
        width: 110,
        height: 40,
        fontSize: 44,
      });
      const captchaId = randomUUID();
      await cache.set(key(captchaId), text, CAPTCHA_TTL_SECONDS);
      return { captchaId, svg: data, expiresIn: CAPTCHA_TTL_SECONDS };
    },

    async verify(captchaId, answer) {
      if (!captchaId) return false;
      const expected = await cache.take<string>(key(captchaId));
      if (!expected) return false;
      const a = Buffer.from(answer.trim());
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}

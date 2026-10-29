import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';

/**
 * @import * as SvgCaptcha from 'svg-captcha'
 * @import { CaptchaResponse } from '@selcos/shared'
 * @import { CacheStore } from '../cache/CacheStore.js'
 */

// svg-captcha 是 CommonJS 套件
/** @type {typeof SvgCaptcha} */
const svgCaptcha = createRequire(import.meta.url)('svg-captcha');

export const CAPTCHA_TTL_SECONDS = 120;
/** @param {string} id */
const key = (id) => `captcha:${id}`;

/**
 * @typedef {object} CaptchaService
 * @property {() => Promise<CaptchaResponse>} create
 * @property {(captchaId: string, answer: string) => Promise<boolean>} verify
 *   驗證後一律作廢（不論對錯），避免同一張驗證碼被重複嘗試
 */

/**
 * @param {CacheStore} cache
 * @returns {CaptchaService}
 */
export function createCaptchaService(cache) {
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
      /** @type {string | undefined} */
      const expected = await cache.take(key(captchaId));
      if (!expected) return false;
      const a = Buffer.from(answer.trim());
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}

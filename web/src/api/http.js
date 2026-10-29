import axios, { AxiosError } from 'axios';

/** @import { ApiError } from '@selcos/shared' */

export const http = axios.create({
  baseURL: '/api',
  timeout: 15_000,
});

/**
 * 取出 API 錯誤訊息，沒有的話用預設文字
 * @param {unknown} err
 * @returns {string}
 */
export function errorMessage(err, fallback = '系統發生錯誤，請稍後再試。') {
  if (err instanceof AxiosError) {
    /** @type {Partial<ApiError> | undefined} */
    const data = err.response?.data;
    if (data?.message) return data.message;
    if (!err.response) return '無法連線到選課系統，請檢查網路。';
  }
  return fallback;
}

/**
 * @param {unknown} err
 * @returns {string | undefined}
 */
export function errorCode(err) {
  return err instanceof AxiosError
    ? /** @type {Partial<ApiError> | undefined} */ (err.response?.data)?.code
    : undefined;
}

/**
 * @typedef {object} HttpHooks
 * @property {() => string | null} getToken
 * @property {(message: string) => void} onUnauthorized token 失效（過期、被其他登入取代）時呼叫
 */

/**
 * 由 main.js 設定，避免 http 與 store 互相 import
 * @param {HttpHooks} hooks
 */
export function setupHttp(hooks) {
  http.interceptors.request.use((config) => {
    const token = hooks.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  http.interceptors.response.use(undefined, (/** @type {unknown} */ err) => {
    const isLogin = err instanceof AxiosError && err.config?.url === '/auth/login';
    if (err instanceof AxiosError && err.response?.status === 401 && !isLogin) {
      hooks.onUnauthorized(errorMessage(err, '請重新登入選課系統。'));
    }
    return Promise.reject(err);
  });
}

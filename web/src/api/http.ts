import axios, { AxiosError } from 'axios';
import type { ApiError } from '@selcos/shared';

export const http = axios.create({
  baseURL: '/api',
  timeout: 15_000,
});

/** 取出 API 錯誤訊息，沒有的話用預設文字 */
export function errorMessage(err: unknown, fallback = '系統發生錯誤，請稍後再試。'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as Partial<ApiError> | undefined;
    if (data?.message) return data.message;
    if (!err.response) return '無法連線到選課系統，請檢查網路。';
  }
  return fallback;
}

export function errorCode(err: unknown): string | undefined {
  return err instanceof AxiosError ? (err.response?.data as Partial<ApiError>)?.code : undefined;
}

interface HttpHooks {
  getToken: () => string | null;
  /** token 失效（過期、被其他登入取代）時呼叫 */
  onUnauthorized: (message: string) => void;
}

/** 由 main.ts 設定，避免 http 與 store 互相 import */
export function setupHttp(hooks: HttpHooks) {
  http.interceptors.request.use((config) => {
    const token = hooks.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  http.interceptors.response.use(undefined, (err: unknown) => {
    const isLogin = err instanceof AxiosError && err.config?.url === '/auth/login';
    if (err instanceof AxiosError && err.response?.status === 401 && !isLogin) {
      hooks.onUnauthorized(errorMessage(err, '請重新登入選課系統。'));
    }
    return Promise.reject(err);
  });
}

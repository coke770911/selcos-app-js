import type { ErrorCode } from '@selcos/shared';

/** 可預期的業務錯誤，錯誤處理器會轉成 { code, message } 與對應的 HTTP status */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

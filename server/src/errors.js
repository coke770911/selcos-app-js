import { ERROR_CODES } from '@selcos/shared';

/** @import { ErrorCode } from '@selcos/shared' */

/** 可預期的業務錯誤，錯誤處理器會轉成 { code, message } 與對應的 HTTP status */
export class AppError extends Error {
  /**
   * @param {number} status
   * @param {ErrorCode} code
   * @param {string} message
   */
  constructor(status, code, message) {
    super(message);
    /** @readonly */
    this.status = status;
    /** @readonly */
    this.code = code;
    this.name = 'AppError';
  }
}

/**
 * 選課尖峰忙碌（等鎖逾時、連線池滿載），請使用者稍後重試
 * @returns {AppError}
 */
export const busyError = () =>
  new AppError(503, ERROR_CODES.INTERNAL, '目前選課人數眾多，系統忙碌中，請稍後再試。');

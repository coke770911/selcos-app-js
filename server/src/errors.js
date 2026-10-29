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

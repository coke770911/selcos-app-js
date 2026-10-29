/** @import { CourseKind } from '@selcos/shared' */

/**
 * 課程類別顏色（對應舊系統 get_cos_info 的色系，調整成深淺模式都清楚）。
 * light 用於淺色背景，dark 用於深色背景。
 * @type {Record<CourseKind, { light: string; dark: string }>}
 */
export const COURSE_KIND_COLORS = {
  elective: { light: '#5b6b99', dark: '#9fb0e6' },
  retakeType: { light: '#993399', dark: '#d58ad5' },
  makeUpType: { light: '#993333', dark: '#e08a8a' },
  summer: { light: '#a8559f', dark: '#e3a6dc' },
  required: { light: '#1f2330', dark: '#e6e8f0' },
  basicGe: { light: '#4d8a4d', dark: '#8fd18f' },
  categoryGe: { light: '#5c5ca8', dark: '#a6a6f0' },
  coreGe: { light: '#996666', dark: '#e0a8a8' },
  liberalArts: { light: '#008f6b', dark: '#3fd6ae' },
  other: { light: '#6b6b6b', dark: '#b3b3b3' },
  pe: { light: '#006699', dark: '#5cc0f0' },
  military: { light: '#2f86b8', dark: '#7fc6ef' },
  cross: { light: '#388e3c', dark: '#7ed482' },
  makeUp: { light: '#b000e6', dark: '#df7cff' },
  retake: { light: '#e5193b', dark: '#ff6b81' },
};

export const WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

/** 節次代碼 01–15 */
export const PERIODS = Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, '0'));

import { getDb } from '../sequelize.js';

/** @import { ScheduleItem } from '@selcos/shared' */

/**
 * @typedef {object} ScheduleRow
 * @property {string} open_datetime
 * @property {string} end_datetime
 * @property {string} sss_1degree
 * @property {string} sss_2degree
 * @property {string} sss_3degree
 * @property {string} sss_4degree
 * @property {string} sss_5degree
 * @property {string} sss_delayDegree
 */

// 舊系統 index.php 的年級對照文字
/** @type {[keyof ScheduleRow, string][]} */
const GROUP_LABELS = [
  ['sss_1degree', '四技一年級、碩班一年級'],
  ['sss_2degree', '四技二年級、碩班二年級'],
  ['sss_3degree', '四技三年級、二技一年級'],
  ['sss_4degree', '四技四年級、二技二年級'],
  ['sss_5degree', '二技三年級'],
  ['sss_delayDegree', '延修生'],
];

/**
 * @param {ScheduleRow} row
 * @returns {ScheduleItem}
 */
export function toScheduleItem(row) {
  return {
    begin: row.open_datetime,
    end: row.end_datetime,
    groups: GROUP_LABELS.filter(([col]) => row[col] === 'Y').map(([, label]) => label),
  };
}

/**
 * @typedef {object} PublicRepository
 * @property {() => Promise<ScheduleItem[]>} findSchedule 尚未結束的選課時段
 */

/** @type {PublicRepository} */
export const publicRepository = {
  async findSchedule() {
    /** @type {ScheduleRow[]} */
    const rows = await getDb().select(
      `SELECT CONVERT(varchar, sss_beginTime, 120) AS open_datetime,
             CONVERT(varchar, sss_endTime, 120) AS end_datetime,
             sss_1degree, sss_2degree, sss_3degree, sss_4degree, sss_5degree, sss_delayDegree
      FROM [OIT].[dbo].[selcostime_setting]
      WHERE sss_endTime > GETDATE()
      ORDER BY sss_beginTime`,
    );
    return rows.map(toScheduleItem);
  },
};

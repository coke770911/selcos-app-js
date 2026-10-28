import type { ScheduleItem } from '@selcos/shared';
import { getPrisma } from '../prisma.js';

interface ScheduleRow {
  open_datetime: string;
  end_datetime: string;
  sss_1degree: string;
  sss_2degree: string;
  sss_3degree: string;
  sss_4degree: string;
  sss_5degree: string;
  sss_delayDegree: string;
}

// 舊系統 index.php 的年級對照文字
const GROUP_LABELS: [keyof ScheduleRow, string][] = [
  ['sss_1degree', '四技一年級、碩班一年級'],
  ['sss_2degree', '四技二年級、碩班二年級'],
  ['sss_3degree', '四技三年級、二技一年級'],
  ['sss_4degree', '四技四年級、二技二年級'],
  ['sss_5degree', '二技三年級'],
  ['sss_delayDegree', '延修生'],
];

export function toScheduleItem(row: ScheduleRow): ScheduleItem {
  return {
    begin: row.open_datetime,
    end: row.end_datetime,
    groups: GROUP_LABELS.filter(([col]) => row[col] === 'Y').map(([, label]) => label),
  };
}

export interface PublicRepository {
  /** 尚未結束的選課時段 */
  findSchedule(): Promise<ScheduleItem[]>;
}

export const publicRepository: PublicRepository = {
  async findSchedule() {
    const rows = await getPrisma().$queryRaw<ScheduleRow[]>`
      SELECT CONVERT(varchar, sss_beginTime, 120) AS open_datetime,
             CONVERT(varchar, sss_endTime, 120) AS end_datetime,
             sss_1degree, sss_2degree, sss_3degree, sss_4degree, sss_5degree, sss_delayDegree
      FROM [OIT].[dbo].[selcostime_setting]
      WHERE sss_endTime > GETDATE()
      ORDER BY sss_beginTime`;
    return rows.map(toScheduleItem);
  },
};

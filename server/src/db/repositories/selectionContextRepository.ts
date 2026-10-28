import { getPrisma } from '../prisma.js';
import type { CreditLimitRow } from '../../domain/creditLimit.js';

export interface CourseRecord {
  /** 課號_冊別 */
  cosPK: string;
  passed: boolean;
}

/** 選課前置資料（舊系統 process.php 登入時的查詢） */
export interface SelectionContextRepository {
  /** 歷年修課紀錄，依成績由低到高 */
  findCourseRecords(stdNo: string): Promise<CourseRecord[]>;
  findCreditLimit(typeNo: string, degree: number): Promise<CreditLimitRow | null>;
  /** 轉學轉系生依入學學年、系、組在本學期之前應修的必修課（含抵免對照課號），格式 課號_冊別 */
  findMustCourses(input: {
    academicYear: string;
    deptNo: string;
    team: string;
    smtr: string;
  }): Promise<string[]>;
  /** 是否已填寫指定學期的期末學習評量問卷 */
  hasQuestionnaire(smtr: string, stdNo: string): Promise<boolean>;
}

export const selectionContextRepository: SelectionContextRepository = {
  async findCourseRecords(stdNo) {
    const rows = await getPrisma().$queryRaw<{ cosPK: string; passState: boolean }[]>`
      SELECT cosPK, passState FROM [OIT].[dbo].[vtSelcos_yearScore]
      WHERE std_no = ${stdNo} ORDER BY score ASC`;
    return rows.map((r) => ({ cosPK: r.cosPK.trim(), passed: Boolean(r.passState) }));
  },

  async findCreditLimit(typeNo, degree) {
    const rows = await getPrisma().$queryRaw<CreditLimitRow[]>`
      SELECT max_credit, min_credit FROM [OIT].[dbo].[cos_std_creditlimit]
      WHERE type_no = ${typeNo} AND std_year = ${String(degree)}`;
    return rows[0] ?? null;
  },

  async findMustCourses({ academicYear, deptNo, team, smtr }) {
    // 舊系統：必修課 + 該必修的抵免對照課（cos_repulsion），排除專業選修 E
    const rows = await getPrisma().$queryRaw<{ cos_id: string; cos_term: string }[]>`
      SELECT refMustCos.cos_id, refMustCos.cos_term
      FROM [OIT].[dbo].[cos_ref_must_cos] AS refMustCos
      INNER JOIN [OIT].[dbo].[perm_course] AS permCos ON permCos.cos_id = refMustCos.cos_id
      WHERE entry_year = ${academicYear} AND dept_no = ${deptNo} AND team = ${team}
        AND cos_smtr < ${smtr} AND cos_type <> 'E'
      UNION
      SELECT repulsionCos.repulsion_cos_id AS cos_id, repulsionCos.repulsion_cos_term AS cos_term
      FROM [OIT].[dbo].[cos_ref_must_cos] AS refMustCos
      INNER JOIN [OIT].[dbo].[cos_repulsion] AS repulsionCos
        ON refMustCos.cos_id = repulsionCos.cos_id AND refMustCos.cos_term = repulsionCos.cos_term
      INNER JOIN [OIT].[dbo].[perm_course] AS permCos ON permCos.cos_id = repulsionCos.cos_id
      WHERE entry_year = ${academicYear} AND dept_no = ${deptNo} AND team = ${team}
        AND cos_smtr < ${smtr} AND cos_type <> 'E'`;
    return rows.map((r) => `${r.cos_id.trim()}_${r.cos_term.trim()}`);
  },

  async hasQuestionnaire(smtr, stdNo) {
    const rows = await getPrisma().$queryRaw<{ n: number }[]>`
      SELECT COUNT(*) AS n FROM [OIT].[dbo].[cos_std_achieve_check]
      WHERE achieve_smtr = ${smtr} AND achieve_stdno = ${stdNo}`;
    return Number(rows[0]?.n ?? 0) > 0;
  },
};

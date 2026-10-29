import { getDb } from '../sequelize.js';

/** @import { CreditLimitRow } from '../../domain/creditLimit.js' */

/**
 * @typedef {object} CourseRecord
 * @property {string} cosPK 課號_冊別
 * @property {boolean} passed
 */

/**
 * 選課前置資料（舊系統 process.php 登入時的查詢）
 * @typedef {object} SelectionContextRepository
 * @property {(stdNo: string) => Promise<CourseRecord[]>} findCourseRecords 歷年修課紀錄，依成績由低到高
 * @property {(typeNo: string, degree: number) => Promise<CreditLimitRow | null>} findCreditLimit
 * @property {(input: { academicYear: string; deptNo: string; team: string; smtr: string }) => Promise<string[]>} findMustCourses
 *   轉學轉系生依入學學年、系、組在本學期之前應修的必修課（含抵免對照課號），格式 課號_冊別
 * @property {(smtr: string, stdNo: string) => Promise<boolean>} hasQuestionnaire
 *   是否已填寫指定學期的期末學習評量問卷
 */

/** @type {SelectionContextRepository} */
export const selectionContextRepository = {
  async findCourseRecords(stdNo) {
    /** @type {{ cosPK: string; passState: boolean }[]} */
    const rows = await getDb().select(
      `SELECT cosPK, passState FROM [OIT].[dbo].[vtSelcos_yearScore]
      WHERE std_no = $stdNo ORDER BY score ASC`,
      { stdNo },
    );
    return rows.map((r) => ({ cosPK: r.cosPK.trim(), passed: Boolean(r.passState) }));
  },

  async findCreditLimit(typeNo, degree) {
    /** @type {CreditLimitRow[]} */
    const rows = await getDb().select(
      `SELECT max_credit, min_credit FROM [OIT].[dbo].[cos_std_creditlimit]
      WHERE type_no = $typeNo AND std_year = $stdYear`,
      { typeNo, stdYear: String(degree) },
    );
    return rows[0] ?? null;
  },

  async findMustCourses({ academicYear, deptNo, team, smtr }) {
    // 舊系統：必修課 + 該必修的抵免對照課（cos_repulsion），排除專業選修 E
    /** @type {{ cos_id: string; cos_term: string }[]} */
    const rows = await getDb().select(
      `SELECT refMustCos.cos_id, refMustCos.cos_term
      FROM [OIT].[dbo].[cos_ref_must_cos] AS refMustCos
      INNER JOIN [OIT].[dbo].[perm_course] AS permCos ON permCos.cos_id = refMustCos.cos_id
      WHERE entry_year = $academicYear AND dept_no = $deptNo AND team = $team
        AND cos_smtr < $smtr AND cos_type <> 'E'
      UNION
      SELECT repulsionCos.repulsion_cos_id AS cos_id, repulsionCos.repulsion_cos_term AS cos_term
      FROM [OIT].[dbo].[cos_ref_must_cos] AS refMustCos
      INNER JOIN [OIT].[dbo].[cos_repulsion] AS repulsionCos
        ON refMustCos.cos_id = repulsionCos.cos_id AND refMustCos.cos_term = repulsionCos.cos_term
      INNER JOIN [OIT].[dbo].[perm_course] AS permCos ON permCos.cos_id = repulsionCos.cos_id
      WHERE entry_year = $academicYear AND dept_no = $deptNo AND team = $team
        AND cos_smtr < $smtr AND cos_type <> 'E'`,
      { academicYear, deptNo, team, smtr },
    );
    return rows.map((r) => `${r.cos_id.trim()}_${r.cos_term.trim()}`);
  },

  async hasQuestionnaire(smtr, stdNo) {
    /** @type {{ n: number }[]} */
    const rows = await getDb().select(
      `SELECT COUNT(*) AS n FROM [OIT].[dbo].[cos_std_achieve_check]
      WHERE achieve_smtr = $smtr AND achieve_stdno = $stdNo`,
      { smtr, stdNo },
    );
    return Number(rows[0]?.n ?? 0) > 0;
  },
};

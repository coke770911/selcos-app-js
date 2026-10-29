import { Transaction } from 'sequelize';
import { ERROR_CODES } from '@selcos/shared';
import { AppError } from '../../errors.js';
import { createSqlRunner, getDb, getSequelize } from '../sequelize.js';

/**
 * @import { SqlRunner } from '../sequelize.js'
 * @import { CourseRow } from './courseRepository.js'
 */

/**
 * 學生本學期已選的課（舊系統 selcos_main.php）
 * @typedef {object} SelectedRow
 * @property {string} sel_smtr
 * @property {string} sel_cos_id
 * @property {string} sel_cos_class
 * @property {string} sel_cos_term
 * @property {string | null} sel_cos_type
 * @property {string} cos_cname
 * @property {number} cos_credit
 * @property {string | null} schd_time
 * @property {string | null} att_foreignLanguage
 * @property {string | null} cos_crossDisciplinary
 */

/**
 * 加選時課程的完整資料（含 chk_* 條件與目前人數）
 * @typedef {CourseRow & {
 *   cos_dept_no: string;
 *   cos_dept: string;
 *   chk_max_num: string;
 *   chk_min_num: string;
 *   chk_over_year: string;
 *   chk_under_year: string;
 *   sel_total: number;
 * }} EnrollCourseRow
 */

/**
 * @typedef {object} CourseKeyParams
 * @property {string} smtr
 * @property {string} cosId
 * @property {string} cosClass
 * @property {string} cosTerm
 */

/**
 * 交易內可用的操作（已持有鎖）
 * @typedef {object} EnrollmentTx
 * @property {(key: CourseKeyParams) => Promise<EnrollCourseRow | null>} findCourse
 * @property {(smtr: string, stdNo: string) => Promise<SelectedRow[]>} findSelected
 * @property {(key: CourseKeyParams, student: { deptNo: string; class: string; degree: number }) => Promise<{ more_flag: string }[]>} findMoreDept
 *   指定可修系所年班（cos_more_dept），已依學生系所、班級、年級篩選
 * @property {(cosId: string) => Promise<string[]>} findClashCosIds 與此課號同性質的其他課號（cos_clash）
 * @property {(key: CourseKeyParams & { stdNo: string; selType: string }) => Promise<void>} insert
 *   呼叫 selcos_ins_cos_smtr_stdregi
 * @property {(key: CourseKeyParams & { stdNo: string }) => Promise<void>} remove
 *   呼叫 selcos_del_cos_smtr_stdregi
 */

/**
 * @typedef {object} EnrollmentRepository
 * @property {<T>(resources: string[], fn: (tx: EnrollmentTx) => Promise<T>) => Promise<T>} withLocks
 *   在交易中依序取得鎖再執行；任何錯誤都會復原整個交易
 * @property {(smtr: string, stdNo: string) => Promise<SelectedRow[]>} findSelected
 */

/** 取鎖逾時（毫秒）：選課尖峰時同一門課排隊的最長等待 */
const LOCK_TIMEOUT_MS = 10_000;

const busy = () =>
  new AppError(503, ERROR_CODES.INTERNAL, '目前選課人數眾多，系統忙碌中，請稍後再試。');

/**
 * @param {SqlRunner} db
 * @param {string} smtr
 * @param {string} stdNo
 * @returns {Promise<SelectedRow[]>}
 */
function selectedQuery(db, smtr, stdNo) {
  return db.select(
    `SELECT sel_smtr, sel_cos_id, sel_cos_class, sel_cos_term, sel_cos_type,
           cos_cname, cos_credit, schd_time, att_foreignLanguage, cos_crossDisciplinary
    FROM [OIT].[dbo].[cos_smtr_stdregi]
    INNER JOIN [OIT].[dbo].[tSelcos_tmpSmtrcos]
      ON cos_smtr = sel_smtr AND cos_id = sel_cos_id AND cos_class = sel_cos_class AND cos_term = sel_cos_term
    WHERE sel_smtr = $smtr AND sel_std_no = $stdNo`,
    { smtr, stdNo },
  );
}

/**
 * @param {SqlRunner} db
 * @returns {EnrollmentTx}
 */
function txOperations(db) {
  return {
    async findCourse({ smtr, cosId, cosClass, cosTerm }) {
      // 與舊系統 ajax_cos_add.php 相同的查詢：開課資料 + 目前人數
      /** @type {EnrollCourseRow[]} */
      const rows = await db.select(
        `SELECT *,
          (SELECT COUNT(sel_std_no) FROM [OIT].[dbo].[cos_smtr_stdregi] AS A
           WHERE sel_smtr = cos_smtr AND sel_cos_id = cos_id AND sel_cos_class = cos_class AND sel_cos_term = cos_term) AS sel_total
        FROM [OIT].[dbo].[tSelcos_tmpSmtrcos]
        WHERE cos_smtr = $smtr AND cos_id = $cosId AND cos_class = $cosClass AND cos_term = $cosTerm`,
        { smtr, cosId, cosClass, cosTerm },
      );
      return rows[0] ?? null;
    },

    findSelected: (smtr, stdNo) => selectedQuery(db, smtr, stdNo),

    findMoreDept({ smtr, cosId, cosClass, cosTerm }, student) {
      return db.select(
        `SELECT more_flag FROM [OIT].[dbo].[cos_more_dept]
        WHERE more_smtr = $smtr AND more_cos_id = $cosId AND more_cos_class = $cosClass
          AND more_cos_term = $cosTerm AND more_dept_no = $deptNo
          AND more_std_class = $stdClass
          AND $degree BETWEEN more_over_year + 1 AND more_under_year - 1`,
        {
          smtr,
          cosId,
          cosClass,
          cosTerm,
          deptNo: student.deptNo,
          stdClass: student.class,
          degree: student.degree,
        },
      );
    },

    async findClashCosIds(cosId) {
      /** @type {{ cos_id: string; other_cos_id: string }[]} */
      const rows = await db.select(
        `SELECT cos_id, other_cos_id FROM [OIT].[dbo].[cos_clash]
        WHERE cos_id = $cosId OR other_cos_id = $cosId`,
        { cosId },
      );
      return rows.map((r) => (r.cos_id.trim() === cosId ? r.other_cos_id : r.cos_id).trim());
    },

    async insert({ smtr, stdNo, cosId, cosClass, selType, cosTerm }) {
      /** @type {{ err: number }[]} */
      const rows = await db.select(
        `EXEC [OIT].[dbo].[selcos_ins_cos_smtr_stdregi] $smtr, $stdNo, $cosId, $cosClass, $selType, $cosTerm`,
        { smtr, stdNo, cosId, cosClass, selType, cosTerm },
      );
      if (Number(rows[0]?.err ?? -1) !== 0)
        throw new Error(`selcos_ins_cos_smtr_stdregi err=${rows[0]?.err}`);
    },

    async remove({ smtr, stdNo, cosId, cosClass, cosTerm }) {
      /** @type {{ err: number }[]} */
      const rows = await db.select(
        `EXEC [OIT].[dbo].[selcos_del_cos_smtr_stdregi] $smtr, $stdNo, $cosId, $cosClass, $cosTerm`,
        { smtr, stdNo, cosId, cosClass, cosTerm },
      );
      if (Number(rows[0]?.err ?? -1) !== 0)
        throw new Error(`selcos_del_cos_smtr_stdregi err=${rows[0]?.err}`);
    },
  };
}

/** @type {EnrollmentRepository} */
export const enrollmentRepository = {
  withLocks(resources, fn) {
    const sequelize = getSequelize();
    // managed transaction：fn 丟出錯誤時自動 rollback，成功才 commit
    return sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction) => {
        const tx = createSqlRunner(sequelize, transaction);
        // SP 內沒有交易：開啟 XACT_ABORT，任何一句失敗整個交易都復原
        await tx.execute(`SET XACT_ABORT ON`);
        for (const resource of resources) {
          /** @type {{ r: number }[]} */
          const rows = await tx.select(
            `DECLARE @r int;
            EXEC @r = sp_getapplock @Resource = $resource, @LockMode = 'Exclusive',
              @LockOwner = 'Transaction', @LockTimeout = $timeoutMs;
            SELECT @r AS r`,
            { resource, timeoutMs: LOCK_TIMEOUT_MS },
          );
          if (Number(rows[0]?.r ?? -1) < 0) throw busy();
        }
        return fn(txOperations(tx));
      },
    );
  },

  findSelected: (smtr, stdNo) => selectedQuery(getDb(), smtr, stdNo),
};

/**
 * 鎖定資源名稱：先學生、後課程，固定順序避免死結
 * @param {string} stdNo
 * @param {CourseKeyParams} key
 * @returns {string[]}
 */
export function lockResources(stdNo, key) {
  return [
    `selcos:std:${stdNo}`,
    `selcos:cos:${key.smtr}:${key.cosId}:${key.cosClass}:${key.cosTerm}`,
  ];
}

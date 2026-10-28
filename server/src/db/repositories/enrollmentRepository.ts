import { ERROR_CODES } from '@selcos/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../prisma.js';
import type { CourseRow } from './courseRepository.js';
import type { SqlRunner } from '../../cache/sqlServerCache.js';

/** 學生本學期已選的課（舊系統 selcos_main.php） */
export interface SelectedRow {
  sel_smtr: string;
  sel_cos_id: string;
  sel_cos_class: string;
  sel_cos_term: string;
  sel_cos_type: string | null;
  cos_cname: string;
  cos_credit: number;
  schd_time: string | null;
  att_foreignLanguage: string | null;
  cos_crossDisciplinary: string | null;
}

/** 加選時課程的完整資料（含 chk_* 條件與目前人數） */
export type EnrollCourseRow = CourseRow & {
  cos_dept_no: string;
  cos_dept: string;
  chk_max_num: string;
  chk_min_num: string;
  chk_over_year: string;
  chk_under_year: string;
  sel_total: number;
};

export interface CourseKeyParams {
  smtr: string;
  cosId: string;
  cosClass: string;
  cosTerm: string;
}

/** 交易內可用的操作（已持有鎖） */
export interface EnrollmentTx {
  findCourse(key: CourseKeyParams): Promise<EnrollCourseRow | null>;
  findSelected(smtr: string, stdNo: string): Promise<SelectedRow[]>;
  /** 指定可修系所年班（cos_more_dept），已依學生系所、班級、年級篩選 */
  findMoreDept(
    key: CourseKeyParams,
    student: { deptNo: string; class: string; degree: number },
  ): Promise<{ more_flag: string }[]>;
  /** 與此課號同性質的其他課號（cos_clash） */
  findClashCosIds(cosId: string): Promise<string[]>;
  /** 呼叫 selcos_ins_cos_smtr_stdregi */
  insert(key: CourseKeyParams & { stdNo: string; selType: string }): Promise<void>;
  /** 呼叫 selcos_del_cos_smtr_stdregi */
  remove(key: CourseKeyParams & { stdNo: string }): Promise<void>;
}

export interface EnrollmentRepository {
  /** 在交易中依序取得鎖再執行；任何錯誤都會復原整個交易 */
  withLocks<T>(resources: string[], fn: (tx: EnrollmentTx) => Promise<T>): Promise<T>;
  findSelected(smtr: string, stdNo: string): Promise<SelectedRow[]>;
}

/** 取鎖逾時（毫秒）：選課尖峰時同一門課排隊的最長等待 */
const LOCK_TIMEOUT_MS = 10_000;

const busy = () =>
  new AppError(503, ERROR_CODES.INTERNAL, '目前選課人數眾多，系統忙碌中，請稍後再試。');

function selectedQuery(db: SqlRunner, smtr: string, stdNo: string) {
  return db.$queryRaw<SelectedRow[]>`
    SELECT sel_smtr, sel_cos_id, sel_cos_class, sel_cos_term, sel_cos_type,
           cos_cname, cos_credit, schd_time, att_foreignLanguage, cos_crossDisciplinary
    FROM [OIT].[dbo].[cos_smtr_stdregi]
    INNER JOIN [OIT].[dbo].[tSelcos_tmpSmtrcos]
      ON cos_smtr = sel_smtr AND cos_id = sel_cos_id AND cos_class = sel_cos_class AND cos_term = sel_cos_term
    WHERE sel_smtr = ${smtr} AND sel_std_no = ${stdNo}`;
}

function txOperations(db: SqlRunner): EnrollmentTx {
  return {
    async findCourse({ smtr, cosId, cosClass, cosTerm }) {
      // 與舊系統 ajax_cos_add.php 相同的查詢：開課資料 + 目前人數
      const rows = await db.$queryRaw<EnrollCourseRow[]>`
        SELECT *,
          (SELECT COUNT(sel_std_no) FROM [OIT].[dbo].[cos_smtr_stdregi] AS A
           WHERE sel_smtr = cos_smtr AND sel_cos_id = cos_id AND sel_cos_class = cos_class AND sel_cos_term = cos_term) AS sel_total
        FROM [OIT].[dbo].[tSelcos_tmpSmtrcos]
        WHERE cos_smtr = ${smtr} AND cos_id = ${cosId} AND cos_class = ${cosClass} AND cos_term = ${cosTerm}`;
      return rows[0] ?? null;
    },

    findSelected: (smtr, stdNo) => selectedQuery(db, smtr, stdNo),

    findMoreDept({ smtr, cosId, cosClass, cosTerm }, student) {
      return db.$queryRaw<{ more_flag: string }[]>`
        SELECT more_flag FROM [OIT].[dbo].[cos_more_dept]
        WHERE more_smtr = ${smtr} AND more_cos_id = ${cosId} AND more_cos_class = ${cosClass}
          AND more_cos_term = ${cosTerm} AND more_dept_no = ${student.deptNo}
          AND more_std_class = ${student.class}
          AND ${student.degree} BETWEEN more_over_year + 1 AND more_under_year - 1`;
    },

    async findClashCosIds(cosId) {
      const rows = await db.$queryRaw<{ cos_id: string; other_cos_id: string }[]>`
        SELECT cos_id, other_cos_id FROM [OIT].[dbo].[cos_clash]
        WHERE cos_id = ${cosId} OR other_cos_id = ${cosId}`;
      return rows.map((r) => (r.cos_id.trim() === cosId ? r.other_cos_id : r.cos_id).trim());
    },

    async insert({ smtr, stdNo, cosId, cosClass, selType, cosTerm }) {
      const rows = await db.$queryRaw<{ err: number }[]>`
        EXEC [OIT].[dbo].[selcos_ins_cos_smtr_stdregi] ${smtr}, ${stdNo}, ${cosId}, ${cosClass}, ${selType}, ${cosTerm}`;
      if (Number(rows[0]?.err ?? -1) !== 0)
        throw new Error(`selcos_ins_cos_smtr_stdregi err=${rows[0]?.err}`);
    },

    async remove({ smtr, stdNo, cosId, cosClass, cosTerm }) {
      const rows = await db.$queryRaw<{ err: number }[]>`
        EXEC [OIT].[dbo].[selcos_del_cos_smtr_stdregi] ${smtr}, ${stdNo}, ${cosId}, ${cosClass}, ${cosTerm}`;
      if (Number(rows[0]?.err ?? -1) !== 0)
        throw new Error(`selcos_del_cos_smtr_stdregi err=${rows[0]?.err}`);
    },
  };
}

export const enrollmentRepository: EnrollmentRepository = {
  withLocks(resources, fn) {
    return getPrisma().$transaction(
      async (tx) => {
        // SP 內沒有交易：開啟 XACT_ABORT，任何一句失敗整個交易都復原
        await tx.$executeRaw`SET XACT_ABORT ON`;
        for (const resource of resources) {
          const rows = await tx.$queryRaw<{ r: number }[]>`
            DECLARE @r int;
            EXEC @r = sp_getapplock @Resource = ${resource}, @LockMode = 'Exclusive',
              @LockOwner = 'Transaction', @LockTimeout = ${LOCK_TIMEOUT_MS};
            SELECT @r AS r`;
          if (Number(rows[0]?.r ?? -1) < 0) throw busy();
        }
        return fn(txOperations(tx as unknown as SqlRunner));
      },
      { maxWait: LOCK_TIMEOUT_MS, timeout: LOCK_TIMEOUT_MS * 2 },
    );
  },

  findSelected: (smtr, stdNo) => selectedQuery(getPrisma(), smtr, stdNo),
};

/** 鎖定資源名稱：先學生、後課程，固定順序避免死結 */
export function lockResources(stdNo: string, key: CourseKeyParams): string[] {
  return [
    `selcos:std:${stdNo}`,
    `selcos:cos:${key.smtr}:${key.cosId}:${key.cosClass}:${key.cosTerm}`,
  ];
}

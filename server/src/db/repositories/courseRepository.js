import { getDb } from '../sequelize.js';

/**
 * tSelcos_tmpSmtrcos 一筆學期開課資料（只列出用到的欄位）
 * @typedef {object} CourseRow
 * @property {string} cos_smtr
 * @property {string} cos_id
 * @property {string} cos_class
 * @property {string} cos_term
 * @property {string} cos_year
 * @property {string} cos_sel_type
 * @property {number} cos_credit
 * @property {string} cos_cname
 * @property {string | null} cos_ename
 * @property {string | null} schd_time
 * @property {string} chk_can_ins
 * @property {string} chk_can_del
 * @property {string} chk_college
 * @property {string} chk_dept
 * @property {string} chk_selcos_dept
 * @property {string | null} teacher_name
 * @property {string | null} dept_name
 * @property {number} max_std
 * @property {number} min_std
 * @property {string | null} memo
 * @property {string | null} att_foreignLanguage
 * @property {string | null} att_internship
 * @property {string | null} att_module
 * @property {string | null} att_courseOfStudy
 * @property {string | null} att_distanceLearning
 * @property {string | null} att_licenseProgram
 * @property {string | null} att_cooperativeEducation
 * @property {string | null} att_specPoint
 * @property {string | null} [cos_crossDisciplinary]
 * @property {number} [sel_total] 只有課程資訊（selcos_get_cosinfo）才有
 */

/**
 * @typedef {object} TypeRow
 * @property {string} type_no
 * @property {string} type_name
 */

/**
 * @typedef {object} DeptRow
 * @property {string} dept_no
 * @property {string} dept_name_s
 * @property {number | null} grad_year
 * @property {string | null} dept_type_no
 */

/**
 * @typedef {object} CourseRepository
 * @property {() => Promise<TypeRow[]>} findTypes 查詢選單的學制（舊系統 ajax_selcos_kind.php）
 * @property {(smtr: string) => Promise<DeptRow[]>} findDepts 本學期有開課的系所
 * @property {(smtr: string, deptNo: string, year: string) => Promise<CourseRow[]>} findByDept
 *   依系所年級查課（selcos_get_coslist mode=1）
 * @property {(smtr: string, weekday: string, period: string) => Promise<CourseRow[]>} findByPeriod
 *   依星期節次查課（selcos_get_coslist mode=0）
 * @property {(smtr: string, cosId: string, cosClass: string, cosTerm: string) => Promise<CourseRow | null>} findInfo
 *   課程資訊含目前人數（selcos_get_cosinfo）
 */

/** 舊系統查詢選單只列這些學制 */
const LISTED_TYPES = ['1', '2', '4', '5', '8', 'R'];

/** @type {CourseRepository} */
export const courseRepository = {
  async findTypes() {
    /** @type {TypeRow[]} */
    const rows = await getDb().select(
      `SELECT type_no, RTRIM(type_name) AS type_name FROM [OIT].[dbo].[ref_type]
      WHERE activeflag = 1`,
    );
    return rows.filter((r) => LISTED_TYPES.includes(String(r.type_no).trim()));
  },

  findDepts(smtr) {
    // 舊系統排除 AS（附設）與 CC000 課號
    return getDb().select(
      `SELECT refDept.dept_no, refDept.dept_name AS dept_name_s,
             refType.gradDegree AS grad_year, refType.type_no AS dept_type_no
      FROM [OIT].[dbo].[cos_smtrcos] AS smtrCos
      INNER JOIN [OIT].[dbo].[ref_dept] AS refDept ON smtrCos.cos_dept_no = refDept.dept_no
      LEFT JOIN [OIT].[dbo].[ref_type] AS refType ON LEFT(smtrCos.cos_dept_no, 1) = refType.type_no
      WHERE SUBSTRING(cos_id, 2, 2) <> 'AS' AND SUBSTRING(cos_id, 2, 5) <> 'CC000'
        AND smtrCos.cos_smtr = $smtr
      GROUP BY refDept.dept_no, refDept.dept_name, refType.gradDegree, refType.type_no`,
      { smtr },
    );
  },

  findByDept(smtr, deptNo, year) {
    return getDb().select(`EXEC [OIT].[dbo].[selcos_get_coslist] 1, $smtr, $deptNo, $year`, {
      smtr,
      deptNo,
      year,
    });
  },

  findByPeriod(smtr, weekday, period) {
    return getDb().select(`EXEC [OIT].[dbo].[selcos_get_coslist] 0, $smtr, $weekday, $period`, {
      smtr,
      weekday,
      period,
    });
  },

  async findInfo(smtr, cosId, cosClass, cosTerm) {
    /** @type {CourseRow[]} */
    const rows = await getDb().select(
      `EXEC [OIT].[dbo].[selcos_get_cosinfo] $smtr, $cosId, $cosClass, $cosTerm`,
      { smtr, cosId, cosClass, cosTerm },
    );
    return rows[0] ?? null;
  },
};

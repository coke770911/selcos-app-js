import { getPrisma } from '../prisma.js';

/** tSelcos_tmpSmtrcos 一筆學期開課資料（只列出用到的欄位） */
export interface CourseRow {
  cos_smtr: string;
  cos_id: string;
  cos_class: string;
  cos_term: string;
  cos_year: string;
  cos_sel_type: string;
  cos_credit: number;
  cos_cname: string;
  cos_ename: string | null;
  schd_time: string | null;
  chk_can_ins: string;
  chk_can_del: string;
  chk_college: string;
  chk_dept: string;
  chk_selcos_dept: string;
  teacher_name: string | null;
  dept_name: string | null;
  max_std: number;
  min_std: number;
  memo: string | null;
  att_foreignLanguage: string | null;
  att_internship: string | null;
  att_module: string | null;
  att_courseOfStudy: string | null;
  att_distanceLearning: string | null;
  att_licenseProgram: string | null;
  att_cooperativeEducation: string | null;
  att_specPoint: string | null;
  cos_crossDisciplinary?: string | null;
  /** 只有課程資訊（selcos_get_cosinfo）才有 */
  sel_total?: number;
}

export interface TypeRow {
  type_no: string;
  type_name: string;
}

export interface DeptRow {
  dept_no: string;
  dept_name_s: string;
  grad_year: number | null;
  dept_type_no: string | null;
}

export interface CourseRepository {
  /** 查詢選單的學制（舊系統 ajax_selcos_kind.php） */
  findTypes(): Promise<TypeRow[]>;
  /** 本學期有開課的系所 */
  findDepts(smtr: string): Promise<DeptRow[]>;
  /** 依系所年級查課（selcos_get_coslist mode=1） */
  findByDept(smtr: string, deptNo: string, year: string): Promise<CourseRow[]>;
  /** 依星期節次查課（selcos_get_coslist mode=0） */
  findByPeriod(smtr: string, weekday: string, period: string): Promise<CourseRow[]>;
  /** 課程資訊含目前人數（selcos_get_cosinfo） */
  findInfo(
    smtr: string,
    cosId: string,
    cosClass: string,
    cosTerm: string,
  ): Promise<CourseRow | null>;
}

/** 舊系統查詢選單只列這些學制 */
const LISTED_TYPES = ['1', '2', '4', '5', '8', 'R'];

export const courseRepository: CourseRepository = {
  async findTypes() {
    const rows = await getPrisma().$queryRaw<TypeRow[]>`
      SELECT type_no, RTRIM(type_name) AS type_name FROM [OIT].[dbo].[ref_type]
      WHERE activeflag = 1`;
    return rows.filter((r) => LISTED_TYPES.includes(String(r.type_no).trim()));
  },

  async findDepts(smtr) {
    // 舊系統排除 AS（附設）與 CC000 課號
    return getPrisma().$queryRaw<DeptRow[]>`
      SELECT refDept.dept_no, refDept.dept_name AS dept_name_s,
             refType.gradDegree AS grad_year, refType.type_no AS dept_type_no
      FROM [OIT].[dbo].[cos_smtrcos] AS smtrCos
      INNER JOIN [OIT].[dbo].[ref_dept] AS refDept ON smtrCos.cos_dept_no = refDept.dept_no
      LEFT JOIN [OIT].[dbo].[ref_type] AS refType ON LEFT(smtrCos.cos_dept_no, 1) = refType.type_no
      WHERE SUBSTRING(cos_id, 2, 2) <> 'AS' AND SUBSTRING(cos_id, 2, 5) <> 'CC000'
        AND smtrCos.cos_smtr = ${smtr}
      GROUP BY refDept.dept_no, refDept.dept_name, refType.gradDegree, refType.type_no`;
  },

  findByDept(smtr, deptNo, year) {
    return getPrisma().$queryRaw<CourseRow[]>`
      EXEC [OIT].[dbo].[selcos_get_coslist] 1, ${smtr}, ${deptNo}, ${year}`;
  },

  findByPeriod(smtr, weekday, period) {
    return getPrisma().$queryRaw<CourseRow[]>`
      EXEC [OIT].[dbo].[selcos_get_coslist] 0, ${smtr}, ${weekday}, ${period}`;
  },

  async findInfo(smtr, cosId, cosClass, cosTerm) {
    const rows = await getPrisma().$queryRaw<CourseRow[]>`
      EXEC [OIT].[dbo].[selcos_get_cosinfo] ${smtr}, ${cosId}, ${cosClass}, ${cosTerm}`;
    return rows[0] ?? null;
  },
};

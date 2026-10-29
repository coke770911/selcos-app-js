/**
 * 課程查詢與課程資訊（舊系統 ajax_selcos_kind.php、ajax_selcos_list.php、selcos_cos_info.php）。
 * 學期一律取登入時的選課學期，不信任前端傳入。
 */
import { ERROR_CODES } from '@selcos/shared';
import { AppError } from '../errors.js';
import { courseLabel } from '../domain/courseLabel.js';

/**
 * @import { CourseFilters, CourseInfo, CourseListItem, SelcosMode } from '@selcos/shared'
 * @import { CourseRepository, CourseRow } from '../db/repositories/courseRepository.js'
 * @import { SelectionContext, SelectionContextStore } from './selectionContext.js'
 */

/** @param {unknown} v */
const trim = (v) => String(v ?? '').trim();

/**
 * @param {string | null | undefined} schdTime
 * @returns {string[]}
 */
export function parsePeriods(schdTime) {
  return trim(schdTime)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 課程資訊的類別名稱（舊系統 fun_tools.php sel_cos_type，與清單標示的名稱略有不同）
 * @type {Record<string, string>}
 */
const SEL_TYPE_NAME = {
  A: '基礎通識',
  B: '分類通識',
  C: '專業必修',
  E: '專業選修',
  T: '博雅通識',
  H: '通識選修',
  P: '核心通識',
};

/**
 * 課程條件說明（舊系統 selcos_cos_info.php）
 * @param {Pick<CourseRow, 'chk_college' | 'chk_dept' | 'chk_selcos_dept'>} row
 */
export function courseCondition(row) {
  if (trim(row.chk_college) === 'Y') return '同學制可跨系選修';
  if (trim(row.chk_dept) === 'Y') return '同系可加選';
  if (trim(row.chk_selcos_dept) === 'Y') return '需檢查系所';
  return '不需檢查選課條件';
}

/**
 * 彈窗按鈕：預選依課程可加選／可退選設定，其他模式一律顯示
 * @param {Pick<CourseRow, 'chk_can_ins' | 'chk_can_del'>} row
 * @param {SelcosMode} mode
 */
export function courseActions(row, mode) {
  if (mode !== '1') return { add: true, drop: true };
  return { add: trim(row.chk_can_ins) === 'Y', drop: trim(row.chk_can_del) === 'Y' };
}

/**
 * @param {CourseRow} row
 * @param {Pick<SelectionContext, 'mode' | 'needFill' | 'failed'>} ctx
 * @returns {CourseListItem}
 */
export function toListItem(row, ctx) {
  const cosId = trim(row.cos_id);
  const cosTerm = trim(row.cos_term);
  const crossDisciplinary = trim(row.cos_crossDisciplinary) === '1';
  return {
    smtr: trim(row.cos_smtr),
    cosId,
    cosClass: trim(row.cos_class),
    cosTerm,
    name: trim(row.cos_cname),
    credit: Number(row.cos_credit),
    year: trim(row.cos_year),
    periods: parsePeriods(row.schd_time),
    canAdd: trim(row.chk_can_ins) === 'Y',
    label: courseLabel({ cosId, cosTerm, selType: trim(row.cos_sel_type), crossDisciplinary }, ctx),
    foreignLanguage: trim(row.att_foreignLanguage),
    crossDisciplinary,
  };
}

/**
 * @param {CourseRow} row
 * @param {SelcosMode} mode
 * @returns {CourseInfo}
 */
export function toInfo(row, mode) {
  /** @type {(label: string, value: unknown) => { label: string; value: string }} */
  const attr = (label, value) => ({ label, value: trim(value) });
  return {
    smtr: trim(row.cos_smtr),
    cosId: trim(row.cos_id),
    cosClass: trim(row.cos_class),
    cosTerm: trim(row.cos_term),
    name: trim(row.cos_cname),
    englishName: trim(row.cos_ename),
    teacher: trim(row.teacher_name),
    typeName: SEL_TYPE_NAME[trim(row.cos_sel_type)] ?? '其他',
    canAdd: trim(row.chk_can_ins) === 'Y',
    canDrop: trim(row.chk_can_del) === 'Y',
    condition: courseCondition(row),
    deptName: trim(row.dept_name),
    year: trim(row.cos_year),
    credit: Number(row.cos_credit),
    periods: parsePeriods(row.schd_time),
    attributes: [
      attr('外語教學', row.att_foreignLanguage),
      attr('實習課程', row.att_internship),
      attr('模組課程', row.att_module),
      attr('學程課程', row.att_courseOfStudy),
      attr('遠距教學', row.att_distanceLearning),
      attr('證照課程', row.att_licenseProgram),
      attr('產學協同', row.att_cooperativeEducation),
      attr('特色課程', row.att_specPoint),
    ],
    minStudents: Number(row.min_std),
    maxStudents: Number(row.max_std),
    currentStudents: Number(row.sel_total ?? 0),
    memo: trim(row.memo) || '無',
    actions: courseActions(row, mode),
  };
}

/** @param {{ repo: CourseRepository; contexts: SelectionContextStore }} deps */
export function createCourseService(deps) {
  /**
   * @param {string} stdNo
   * @returns {Promise<SelectionContext>}
   */
  async function context(stdNo) {
    const ctx = await deps.contexts.load(stdNo);
    if (!ctx) {
      throw new AppError(
        401,
        ERROR_CODES.SESSION_EXPIRED,
        '網頁放置過久或已登出，請重新登入選課系統！',
      );
    }
    return ctx;
  }

  return {
    /**
     * @param {string} stdNo
     * @returns {Promise<CourseFilters>}
     */
    async filters(stdNo) {
      const ctx = await context(stdNo);
      const [types, depts] = await Promise.all([
        deps.repo.findTypes(),
        deps.repo.findDepts(ctx.smtr),
      ]);
      return {
        types: types.map((t) => ({ typeNo: trim(t.type_no), typeName: trim(t.type_name) })),
        depts: depts.map((d) => ({
          deptNo: trim(d.dept_no),
          deptName: trim(d.dept_name_s),
          typeNo: trim(d.dept_type_no),
          gradYear: Number(d.grad_year ?? 0),
        })),
      };
    },

    /**
     * @param {string} stdNo
     * @param {{ mode: 'dept'; deptNo: string; year: string } | { mode: 'time'; weekday: string; period: string }} query
     * @returns {Promise<CourseListItem[]>}
     */
    async list(stdNo, query) {
      const ctx = await context(stdNo);
      const rows =
        query.mode === 'dept'
          ? await deps.repo.findByDept(ctx.smtr, query.deptNo, query.year)
          : await deps.repo.findByPeriod(ctx.smtr, query.weekday, query.period);
      return rows.map((r) => toListItem(r, ctx));
    },

    /**
     * @param {string} stdNo
     * @param {{ cosId: string; cosClass: string; cosTerm: string }} key
     */
    async info(stdNo, key) {
      const ctx = await context(stdNo);
      const row = await deps.repo.findInfo(ctx.smtr, key.cosId, key.cosClass, key.cosTerm);
      if (!row) throw new AppError(404, ERROR_CODES.NOT_FOUND, '查無課程');
      return toInfo(row, ctx.mode);
    },
  };
}

/** @typedef {ReturnType<typeof createCourseService>} CourseService */

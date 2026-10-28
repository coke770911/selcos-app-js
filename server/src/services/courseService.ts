/**
 * 課程查詢與課程資訊（舊系統 ajax_selcos_kind.php、ajax_selcos_list.php、selcos_cos_info.php）。
 * 學期一律取登入時的選課學期，不信任前端傳入。
 */
import {
  ERROR_CODES,
  type CourseFilters,
  type CourseInfo,
  type CourseListItem,
  type SelcosMode,
} from '@selcos/shared';
import { AppError } from '../errors.js';
import { courseLabel } from '../domain/courseLabel.js';
import type { CourseRepository, CourseRow } from '../db/repositories/courseRepository.js';
import type { SelectionContext, SelectionContextStore } from './selectionContext.js';

const trim = (v: unknown) => String(v ?? '').trim();

export function parsePeriods(schdTime: string | null | undefined): string[] {
  return trim(schdTime)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 課程資訊的類別名稱（舊系統 fun_tools.php sel_cos_type，與清單標示的名稱略有不同） */
const SEL_TYPE_NAME: Record<string, string> = {
  A: '基礎通識',
  B: '分類通識',
  C: '專業必修',
  E: '專業選修',
  T: '博雅通識',
  H: '通識選修',
  P: '核心通識',
};

/** 課程條件說明（舊系統 selcos_cos_info.php） */
export function courseCondition(
  row: Pick<CourseRow, 'chk_college' | 'chk_dept' | 'chk_selcos_dept'>,
) {
  if (trim(row.chk_college) === 'Y') return '同學制可跨系選修';
  if (trim(row.chk_dept) === 'Y') return '同系可加選';
  if (trim(row.chk_selcos_dept) === 'Y') return '需檢查系所';
  return '不需檢查選課條件';
}

/** 彈窗按鈕：預選依課程可加選／可退選設定，其他模式一律顯示 */
export function courseActions(
  row: Pick<CourseRow, 'chk_can_ins' | 'chk_can_del'>,
  mode: SelcosMode,
) {
  if (mode !== '1') return { add: true, drop: true };
  return { add: trim(row.chk_can_ins) === 'Y', drop: trim(row.chk_can_del) === 'Y' };
}

export function toListItem(
  row: CourseRow,
  ctx: Pick<SelectionContext, 'mode' | 'needFill' | 'failed'>,
): CourseListItem {
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

export function toInfo(row: CourseRow, mode: SelcosMode): CourseInfo {
  const attr = (label: string, value: unknown) => ({ label, value: trim(value) });
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

export function createCourseService(deps: {
  repo: CourseRepository;
  contexts: SelectionContextStore;
}) {
  async function context(stdNo: string): Promise<SelectionContext> {
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
    async filters(stdNo: string): Promise<CourseFilters> {
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

    async list(
      stdNo: string,
      query:
        | { mode: 'dept'; deptNo: string; year: string }
        | { mode: 'time'; weekday: string; period: string },
    ): Promise<CourseListItem[]> {
      const ctx = await context(stdNo);
      const rows =
        query.mode === 'dept'
          ? await deps.repo.findByDept(ctx.smtr, query.deptNo, query.year)
          : await deps.repo.findByPeriod(ctx.smtr, query.weekday, query.period);
      return rows.map((r) => toListItem(r, ctx));
    },

    async info(stdNo: string, key: { cosId: string; cosClass: string; cosTerm: string }) {
      const ctx = await context(stdNo);
      const row = await deps.repo.findInfo(ctx.smtr, key.cosId, key.cosClass, key.cosTerm);
      if (!row) throw new AppError(404, ERROR_CODES.NOT_FOUND, '查無課程');
      return toInfo(row, ctx.mode);
    },
  };
}

export type CourseService = ReturnType<typeof createCourseService>;

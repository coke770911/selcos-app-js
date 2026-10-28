/**
 * 加退選（舊系統 ajax_cos_add.php、ajax_cos_del.php）。
 * 在交易中依序鎖定學生與課程，鎖內重新查課表與人數再檢查規則，避免同時操作造成超收或衝堂。
 */
import { ERROR_CODES, type EnrollRequest, type SelectionState } from '@selcos/shared';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';
import { checkAdd, type RuleCourse } from '../domain/addRules.js';
import { checkDrop } from '../domain/dropRules.js';
import { summarizeSelection } from '../domain/currentSelection.js';
import { courseLabel } from '../domain/courseLabel.js';
import {
  lockResources,
  type EnrollCourseRow,
  type EnrollmentRepository,
  type SelectedRow,
} from '../db/repositories/enrollmentRepository.js';
import type { SelectionContext, SelectionContextStore } from './selectionContext.js';
import { parsePeriods } from './courseService.js';

const trim = (v: unknown) => String(v ?? '').trim();
const yes = (v: unknown) => trim(v) === 'Y';

export function toRuleCourse(row: EnrollCourseRow): RuleCourse {
  return {
    cosId: trim(row.cos_id),
    cosClass: trim(row.cos_class),
    cosTerm: trim(row.cos_term),
    cosYear: trim(row.cos_year),
    selType: trim(row.cos_sel_type),
    credit: Number(row.cos_credit),
    periods: parsePeriods(row.schd_time),
    deptNo: trim(row.cos_dept_no),
    dept: trim(row.cos_dept),
    maxStudents: Number(row.max_std),
    minStudents: Number(row.min_std),
    selected: Number(row.sel_total),
    chkMaxNum: yes(row.chk_max_num),
    chkMinNum: yes(row.chk_min_num),
    canInsert: yes(row.chk_can_ins),
    canDelete: yes(row.chk_can_del),
    chkCollege: yes(row.chk_college),
    chkDept: yes(row.chk_dept),
    chkSelcosDept: yes(row.chk_selcos_dept),
    overYear: Number(row.chk_over_year),
    underYear: Number(row.chk_under_year),
  };
}

function toSelected(rows: SelectedRow[]) {
  return rows.map((r) => ({
    cosId: trim(r.sel_cos_id),
    credit: Number(r.cos_credit),
    periods: parsePeriods(r.schd_time),
  }));
}

export function toState(rows: SelectedRow[], ctx: SelectionContext): SelectionState {
  const summary = summarizeSelection(toSelected(rows));
  return {
    courses: rows.map((r) => {
      const cosId = trim(r.sel_cos_id);
      const cosTerm = trim(r.sel_cos_term);
      const crossDisciplinary = trim(r.cos_crossDisciplinary) === '1';
      return {
        smtr: trim(r.sel_smtr),
        cosId,
        cosClass: trim(r.sel_cos_class),
        cosTerm,
        name: trim(r.cos_cname),
        credit: Number(r.cos_credit),
        periods: parsePeriods(r.schd_time),
        label: courseLabel(
          { cosId, cosTerm, selType: trim(r.sel_cos_type), crossDisciplinary },
          { mode: '1', needFill: [], failed: [] },
        ),
        foreignLanguage: trim(r.att_foreignLanguage),
        crossDisciplinary,
      };
    }),
    credit: { now: summary.credit, max: ctx.credit.max, min: ctx.credit.min },
  };
}

const rejected = (message: string) => new AppError(409, ERROR_CODES.ENROLL_REJECTED, message);

export function createEnrollmentService(deps: {
  repo: EnrollmentRepository;
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
    async state(stdNo: string): Promise<SelectionState> {
      const ctx = await context(stdNo);
      return toState(await deps.repo.findSelected(ctx.smtr, stdNo), ctx);
    },

    async add(stdNo: string, req: EnrollRequest): Promise<SelectionState> {
      const ctx = await context(stdNo);
      const key = { smtr: ctx.smtr, ...req };
      return deps.repo.withLocks(lockResources(stdNo, key), async (tx) => {
        const row = await tx.findCourse(key);
        if (!row) throw rejected('查無此課程資料，請試試看重新整理網頁！');
        const course = toRuleCourse(row);

        const selected = await tx.findSelected(ctx.smtr, stdNo);
        const [moreDept, clashCosIds] = await Promise.all([
          course.chkSelcosDept
            ? tx.findMoreDept(key, {
                deptNo: ctx.student.deptNo,
                class: ctx.student.class,
                degree: ctx.currentDegree,
              })
            : null,
          tx.findClashCosIds(course.cosId),
        ]);

        const result = checkAdd({
          course,
          ctx,
          current: summarizeSelection(toSelected(selected)),
          moreDept: moreDept?.map((m) => ({ moreFlag: trim(m.more_flag) })) ?? null,
          clashCosIds,
        });
        if (!result.ok) throw rejected(result.message);

        try {
          await tx.insert({ ...key, stdNo, selType: result.selType });
        } catch (err) {
          logger.error({ err, stdNo, key }, 'insert failed');
          throw new AppError(
            500,
            ERROR_CODES.INTERNAL,
            '系統無法加選課程，請洽詢教務處教務行政組！',
          );
        }
        return toState(await tx.findSelected(ctx.smtr, stdNo), ctx);
      });
    },

    async drop(stdNo: string, req: EnrollRequest): Promise<SelectionState> {
      const ctx = await context(stdNo);
      const key = { smtr: ctx.smtr, ...req };
      return deps.repo.withLocks(lockResources(stdNo, key), async (tx) => {
        const row = await tx.findCourse(key);
        if (!row) throw rejected('無此課程資料，請試著重新整理網頁！');
        const course = toRuleCourse(row);

        const selected = await tx.findSelected(ctx.smtr, stdNo);
        const enrolled = selected.some(
          (s) =>
            trim(s.sel_cos_id) === course.cosId &&
            trim(s.sel_cos_class) === course.cosClass &&
            trim(s.sel_cos_term) === course.cosTerm,
        );
        const result = checkDrop({
          course,
          ctx,
          currentCredit: summarizeSelection(toSelected(selected)).credit,
          enrolled,
        });
        if (!result.ok) throw rejected(result.message);

        try {
          await tx.remove({ ...key, stdNo });
        } catch (err) {
          logger.error({ err, stdNo, key }, 'remove failed');
          throw new AppError(500, ERROR_CODES.INTERNAL, '退選失敗，請洽詢教務處教務行政組！');
        }
        return toState(await tx.findSelected(ctx.smtr, stdNo), ctx);
      });
    },
  };
}

export type EnrollmentService = ReturnType<typeof createEnrollmentService>;

/**
 * 退選規則（舊系統 ajax_cos_del.php），依舊系統順序檢查。
 * 新增：先確認課程在學生課表中（舊系統未檢查，會留下一筆沒有實際刪除的異動紀錄）。
 */
import type { SelcosMode } from '@selcos/shared';
import type { RuleCourse } from './addRules.js';

export interface DropRuleContext {
  mode: SelcosMode;
  student: { state: string };
  credit: { max: number; min: number };
  failed: string[];
  needFill: string[];
  rules: {
    /** chk_sel_stdnum_min：檢查課程人數下限 */
    checkStudentMin: boolean;
    /** chk_sel_cosmin_can_del：人數等於下限時不可再退 */
    courseMinCanDrop: boolean;
  };
}

export interface DropRuleInput {
  course: RuleCourse;
  ctx: DropRuleContext;
  /** 學生本學期目前學分 */
  currentCredit: number;
  /** 課程是否在學生本學期課表中 */
  enrolled: boolean;
}

export type DropRuleResult = { ok: true } | { ok: false; message: string };

export function checkDrop({ course, ctx, currentCredit, enrolled }: DropRuleInput): DropRuleResult {
  const fail = (message: string): DropRuleResult => ({ ok: false, message });

  if (!enrolled) return fail('此課程不在您的課表中，請重新整理網頁！');

  // 設定不可退選的課（通常是必修配班），只有重修、補修可以退
  if (!course.canDelete) {
    const pk = `${course.cosId}_${course.cosTerm}`;
    const isRetakeOrMakeUp =
      ctx.mode !== '1' && (ctx.failed.includes(pk) || ctx.needFill.includes(pk));
    if (!isRetakeOrMakeUp) return fail('此課程設定不可退選。');
  }

  // 延修生一律可退，不檢查人數下限
  if (ctx.student.state !== '06') {
    if (ctx.rules.checkStudentMin && course.chkMinNum && course.selected <= course.minStudents) {
      return fail('此課程人數低於下限，不可退選。');
    }
    if (ctx.rules.courseMinCanDrop && course.selected === course.minStudents) {
      return fail('此課程需大於課程人數下限，才可以退選。');
    }
  }

  // 加退選、暑修不可退到低於應修學分下限
  if (ctx.mode !== '1' && ctx.credit.min !== 0 && ctx.credit.min > currentCredit - course.credit) {
    return fail('退選此課程將低於規定學分，不可退選。');
  }

  return { ok: true };
}

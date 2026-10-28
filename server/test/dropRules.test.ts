import { describe, expect, it } from 'vitest';
import { checkDrop, type DropRuleContext, type DropRuleInput } from '../src/domain/dropRules.js';
import type { RuleCourse } from '../src/domain/addRules.js';

const course = (c: Partial<RuleCourse> = {}): RuleCourse => ({
  cosId: '4IM2001',
  cosClass: 'A',
  cosTerm: '1',
  cosYear: '2',
  selType: 'C',
  credit: 3,
  periods: [],
  deptNo: '4IM',
  dept: '4IM',
  maxStudents: 50,
  minStudents: 15,
  selected: 30,
  chkMaxNum: true,
  chkMinNum: true,
  canInsert: true,
  canDelete: true,
  chkCollege: false,
  chkDept: false,
  chkSelcosDept: false,
  overYear: 0,
  underYear: 9,
  ...c,
});

const ctx = (c: Partial<DropRuleContext> = {}): DropRuleContext => ({
  mode: '2',
  student: { state: '01' },
  credit: { max: 25, min: 15 },
  failed: [],
  needFill: [],
  rules: { checkStudentMin: true, courseMinCanDrop: false },
  ...c,
});

const msg = (i: Partial<DropRuleInput> = {}) => {
  const r = checkDrop({ course: course(), ctx: ctx(), currentCredit: 20, enrolled: true, ...i });
  return r.ok ? null : r.message;
};

// 案例與訊息對照舊系統 ajax_cos_del.php
describe('checkDrop', () => {
  it('全部通過', () => {
    expect(msg()).toBeNull();
  });

  it('新增：課程不在課表中', () => {
    expect(msg({ enrolled: false })).toBe('此課程不在您的課表中，請重新整理網頁！');
  });

  it('不可退選的課，只有重修、補修可退（預選不例外）', () => {
    const locked = course({ canDelete: false });
    expect(msg({ course: locked })).toBe('此課程設定不可退選。');
    expect(msg({ course: locked, ctx: ctx({ failed: ['4IM2001_1'] }) })).toBeNull();
    expect(msg({ course: locked, ctx: ctx({ needFill: ['4IM2001_1'] }) })).toBeNull();
    expect(msg({ course: locked, ctx: ctx({ mode: '1', failed: ['4IM2001_1'] }) })).toBe(
      '此課程設定不可退選。',
    );
  });

  it('人數下限（課程與時段都要開啟檢查）', () => {
    expect(msg({ course: course({ selected: 15 }) })).toBe('此課程人數低於下限，不可退選。');
    expect(msg({ course: course({ selected: 15, chkMinNum: false }) })).toBeNull();
    expect(
      msg({
        course: course({ selected: 15 }),
        ctx: ctx({ rules: { checkStudentMin: false, courseMinCanDrop: false } }),
      }),
    ).toBeNull();
  });

  it('人數等於下限時不可再退（chk_sel_cosmin_can_del）', () => {
    const c = ctx({ rules: { checkStudentMin: false, courseMinCanDrop: true } });
    expect(msg({ course: course({ selected: 15 }), ctx: c })).toBe(
      '此課程需大於課程人數下限，才可以退選。',
    );
    expect(msg({ course: course({ selected: 16 }), ctx: c })).toBeNull();
  });

  it('延修生不檢查人數下限', () => {
    expect(
      msg({ course: course({ selected: 1 }), ctx: ctx({ student: { state: '06' } }) }),
    ).toBeNull();
  });

  it('加退選不可退到低於學分下限；下限 0 或預選不檢查', () => {
    expect(msg({ currentCredit: 17 })).toBe('退選此課程將低於規定學分，不可退選。');
    expect(msg({ currentCredit: 18 })).toBeNull();
    expect(msg({ currentCredit: 3, ctx: ctx({ credit: { max: 25, min: 0 } }) })).toBeNull();
    expect(msg({ currentCredit: 3, ctx: ctx({ mode: '1' }) })).toBeNull();
  });
});

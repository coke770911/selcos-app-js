import { describe, expect, it } from 'vitest';
import {
  checkAdd,
  resolveRetake,
  type AddRuleContext,
  type AddRuleInput,
  type CurrentSelection,
  type RuleCourse,
} from '../src/domain/addRules.js';
import { countGecPassed, emptyGecPassCounts } from '../src/domain/gec.js';

const course = (c: Partial<RuleCourse> = {}): RuleCourse => ({
  cosId: '4IM2001',
  cosClass: 'A',
  cosTerm: '1',
  cosYear: '2',
  selType: 'E',
  credit: 3,
  periods: ['301', '302'],
  deptNo: '4IM',
  dept: '4IM',
  maxStudents: 50,
  minStudents: 15,
  selected: 10,
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

const ctx = (c: Partial<AddRuleContext> = {}): AddRuleContext => ({
  mode: '2',
  student: { typeNo: '4', deptNo: '4IM', class: 'A', state: '01', academicYear: '112' },
  currentDegree: 2,
  credit: { max: 25, min: 15 },
  passed: [],
  failed: [],
  needFill: [],
  gec: emptyGecPassCounts(),
  rules: {
    checkStudentMax: true,
    checkPrerequisite: false,
    firstYearCoursesBlocked: false,
    checkDegree: true,
  },
  ...c,
});

const current = (c: Partial<CurrentSelection> = {}): CurrentSelection => ({
  cosIds: [],
  periods: new Set(),
  credit: 0,
  gec: { P: 0, T: 0, PE: 0, MT: 0, N: 0 },
  ...c,
});

const input = (i: Partial<AddRuleInput> = {}): AddRuleInput => ({
  course: course(),
  ctx: ctx(),
  current: current(),
  moreDept: null,
  clashCosIds: [],
  ...i,
});

const msg = (i: Partial<AddRuleInput>) => {
  const r = checkAdd(input(i));
  return r.ok ? null : r.message;
};

// 案例與訊息對照舊系統 ajax_cos_add.php
describe('checkAdd：基本限制', () => {
  it('全部通過時回傳原課別', () => {
    expect(checkAdd(input())).toEqual({ ok: true, selType: 'E' });
  });

  it('特殊課號', () => {
    expect(msg({ course: course({ cosId: '1CC1998Z' }) })).toBe('此課程為特殊課程無法加選！');
  });

  it('112 學年後不可選博雅世界文明類；之前入學可以', () => {
    expect(msg({ course: course({ cosId: '1CC1321' }) })).toBe('此課程非課綱內通識，無法加選！');
    const before = ctx({ student: { ...ctx().student, academicYear: '111' } });
    expect(msg({ course: course({ cosId: '1CC1321' }), ctx: before })).toBeNull();
  });

  it('一年級課程限制', () => {
    const c = ctx({ rules: { ...ctx().rules, firstYearCoursesBlocked: true } });
    expect(msg({ course: course({ cosYear: '1' }), ctx: c })).toBe(
      '新學年第一學期無法加選一年級課程！',
    );
  });

  it('本學期已選過；體育可重複選', () => {
    const cur = current({ cosIds: ['4IM2001', '1CC1998'] });
    expect(msg({ current: cur })).toBe('您這學期課表已選過此課程！');
    expect(msg({ current: cur, course: course({ cosId: '1CC1998', selType: 'A' }) })).toBeNull();
  });

  it('核通同類一學期只能一門', () => {
    expect(
      msg({
        course: course({ cosId: '1CC1201', selType: 'P' }),
        current: current({ cosIds: ['1CC1200'] }),
      }),
    ).toBe('您這學期課表已選過相同核心通識課程！');
  });

  it('衝堂', () => {
    expect(msg({ current: current({ periods: new Set(['302']) }) })).toBe(
      '此課程與您目前課表衝堂！',
    );
  });

  it('學分上限（等於上限可以）', () => {
    expect(msg({ current: current({ credit: 23 }) })).toBe('無法加選課程，學分已超出上限！');
    expect(msg({ current: current({ credit: 22 }) })).toBeNull();
  });

  it('已修過並及格；體育除外', () => {
    expect(msg({ ctx: ctx({ passed: ['4IM2001_1'] }) })).toBe('此課程你已修過並及格通過！');
    expect(
      msg({
        course: course({ cosId: '1CC1998', selType: 'A' }),
        ctx: ctx({ passed: ['1CC1998_1'], gec: countGecPassed(['1CC1998_1']) }),
      }),
    ).toBeNull();
  });
});

describe('checkAdd：體育、核通、博雅', () => {
  const pe = course({ cosId: '1CC1998', selType: 'A' });
  const passedPE = (n: number) => ctx({ gec: { ...emptyGecPassCounts(), PE: n }, passed: [] });

  it('已修滿 4 門', () => {
    expect(msg({ course: pe, ctx: passedPE(4) })).toBe('您已修4門體育課程！，不需要再選體育！');
  });

  it('已修加本學期已選達 4 門', () => {
    expect(
      msg({ course: pe, ctx: passedPE(3), current: current({ gec: { ...current().gec, PE: 1 } }) }),
    ).toBe('您已修3門體育課程，最多修畢四門體育！');
  });

  it('每學期 1 門；未擋修且 3 年級以上可 2 門', () => {
    const one = current({ gec: { ...current().gec, PE: 1 } });
    expect(msg({ course: pe, ctx: passedPE(0), current: one })).toBe('您這學期已選過1門體育課程！');
    const senior = ctx({ currentDegree: 3 });
    expect(msg({ course: pe, ctx: senior, current: one })).toBeNull();
    const checked = ctx({ currentDegree: 3, rules: { ...ctx().rules, checkPrerequisite: true } });
    expect(msg({ course: pe, ctx: checked, current: one })).toBe('您這學期已選過1門體育課程！');
  });

  it('核心通識每類只需修過一次', () => {
    const c = ctx({ gec: { ...emptyGecPassCounts(), P2: 1 } });
    expect(msg({ course: course({ cosId: '1CC1220', selType: 'P' }), ctx: c })).toBe(
      '您已選過核心通識[歷史文化]類！',
    );
    expect(msg({ course: course({ cosId: '1CC1230', selType: 'P' }), ctx: c })).toBeNull();
  });

  it('博雅：112 學年後上限 4 門，之前 5 門', () => {
    const t = course({ cosId: '1CC1351', selType: 'T' });
    const passed3 = { ...emptyGecPassCounts(), T1: 2, T3: 1 };
    expect(msg({ course: t, ctx: ctx({ gec: { ...passed3, T5: 1 } }) })).toBe(
      '您已修過四門博雅通識不需再選，請確認博雅通識類別是否已修過二類以上！',
    );
    const curT = current({ gec: { ...current().gec, T: 1 } });
    expect(msg({ course: t, ctx: ctx({ gec: passed3 }), current: curT })).toBe(
      '您已修過博雅通識與目前加選的博雅通識，已達四門博雅通識無法再加選！',
    );
    const old = ctx({ gec: passed3, student: { ...ctx().student, academicYear: '111' } });
    expect(msg({ course: t, ctx: old, current: curT })).toBeNull();
    expect(msg({ course: t, ctx: { ...old, gec: { ...passed3, T2: 2 } } })).toBe(
      '您已修過五門博雅通識不需再選，請確認博雅通識類別是否已修過三類以上！',
    );
  });

  it('人數上限（課程與時段都要開啟檢查）', () => {
    const full = course({ selected: 50 });
    expect(msg({ course: full })).toBe('此課程人數已達上限，不可再加選！');
    expect(msg({ course: { ...full, chkMaxNum: false } })).toBeNull();
    expect(
      msg({ course: full, ctx: ctx({ rules: { ...ctx().rules, checkStudentMax: false } }) }),
    ).toBeNull();
  });
});

describe('resolveRetake：重修、補修判定', () => {
  it('預選不判定', () => {
    expect(resolveRetake(course(), ctx({ mode: '1', failed: ['4IM2001_1'] }))).toEqual({
      skipConditions: false,
      selType: 'E',
    });
  });

  it('補修改 S、重修改 R，重修優先', () => {
    expect(resolveRetake(course(), ctx({ needFill: ['4IM2001_1'] }))).toEqual({
      skipConditions: true,
      selType: 'S',
    });
    expect(
      resolveRetake(course(), ctx({ needFill: ['4IM2001_1'], failed: ['4IM2001_1'] })).selType,
    ).toBe('R');
  });

  it('核通、博雅重修可修同類（前 6 碼）', () => {
    const r = resolveRetake(
      course({ cosId: '1CC1351B', selType: 'T' }),
      ctx({ failed: ['1CC1350_1'] }),
    );
    expect(r).toEqual({ skipConditions: true, selType: 'R' });
  });

  it('體育重修可修同類', () => {
    const r = resolveRetake(
      course({ cosId: '1CC1999', selType: 'A', cosTerm: '2' }),
      ctx({ failed: ['1CC1998_1'] }),
    );
    expect(r.selType).toBe('R');
  });

  it('與舊系統相同：補修後課別變 S，就不再以核通、博雅同類判定重修', () => {
    const r = resolveRetake(
      course({ cosId: '1CC1351', selType: 'T' }),
      ctx({ needFill: ['1CC1351_1'], failed: ['1CC1350_1'] }),
    );
    expect(r).toEqual({ skipConditions: true, selType: 'S' });
  });

  it('與舊系統相同：核通、博雅比對時改用前 7 碼，之後的完全比對也用前 7 碼', () => {
    // 1CC1351B_1 第一輪被改成 1CC1351_1，第二輪剛好完全相同 → 重修
    const r = resolveRetake(
      course({ cosId: '1CC1351B', selType: 'T' }),
      ctx({ failed: ['4IM9999_1', '1CC1351_1'] }),
    );
    expect(r.selType).toBe('R');
  });
});

describe('checkAdd：選課條件（重修、補修可略過）', () => {
  it('不可加選', () => {
    expect(msg({ course: course({ canInsert: false }) })).toBe('此課程設定不可加選。');
    // 重修可略過
    expect(
      checkAdd(
        input({ course: course({ canInsert: false }), ctx: ctx({ failed: ['4IM2001_1'] }) }),
      ),
    ).toEqual({
      ok: true,
      selType: 'R',
    });
  });

  it('跨學制選修：學制需相同，且不再檢查年級與系所', () => {
    const c = course({ chkCollege: true, deptNo: '1IM', overYear: 5, chkDept: true, dept: '1IM' });
    expect(msg({ course: c })).toBe('學制相同才能加選！');
    expect(msg({ course: { ...c, deptNo: '4XX' } })).toBeNull();
  });

  it('年級範圍與提示訊息', () => {
    expect(msg({ course: course({ overYear: 2, underYear: 4 }) })).toBe(
      '此課程限定3年級同學才可加選',
    );
    expect(msg({ course: course({ overYear: 2, underYear: 5 }) })).toBe(
      '此課程限定3年級到4年級的同學才可加選',
    );
  });

  it('延修生在時段未要求檢查年級時不檢查', () => {
    const delayed = ctx({
      student: { ...ctx().student, state: '06' },
      rules: { ...ctx().rules, checkDegree: false },
    });
    expect(msg({ course: course({ overYear: 3 }), ctx: delayed })).toBeNull();
    expect(msg({ course: course({ overYear: 3 }), ctx: { ...delayed, rules: ctx().rules } })).toBe(
      '此課程限定4年級到8年級的同學才可加選',
    );
  });

  it('同系才能加選', () => {
    expect(msg({ course: course({ chkDept: true, dept: '4XX' }) })).toBe('同系才能加選！');
  });

  it('指定可修系所年班', () => {
    const c = course({ chkSelcosDept: true });
    expect(msg({ course: c, moreDept: [] })).toBe('此課程目前不開放您的系所選修！');
    expect(msg({ course: c, moreDept: [{ moreFlag: 'N' }] })).toBe(
      '此課程目前只開放限定系所、年級、班級選修，詳細請看通識中心與教務行政組公告！',
    );
    expect(msg({ course: c, moreDept: [{ moreFlag: 'Y' }] })).toBeNull();
  });
});

describe('checkAdd：同性質課程、暑修', () => {
  it('同性質課程已在其他學期及格', () => {
    expect(msg({ clashCosIds: ['4IM1999'], ctx: ctx({ passed: ['4IM1999_1'] }) })).toBe(
      '重複選課！此課程已在其他學期選過！',
    );
    expect(msg({ clashCosIds: ['4IM1999'] })).toBeNull();
  });

  it('暑修一律寫入課別 J', () => {
    expect(checkAdd(input({ ctx: ctx({ mode: '3', failed: ['4IM2001_1'] }) }))).toEqual({
      ok: true,
      selType: 'J',
    });
  });
});

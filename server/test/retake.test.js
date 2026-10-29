import { describe, expect, it } from 'vitest';
import { buildRetakeLists } from '../src/domain/retake.js';
import { countGecPassed, emptyGecPassCounts } from '../src/domain/gec.js';

const base = {
  mode: /** @type {const} */ ('2'),
  stdType: '0',
  passed: /** @type {string[]} */ ([]),
  failed: /** @type {string[]} */ ([]),
  mustCourses: /** @type {string[]} */ ([]),
  gec: emptyGecPassCounts(),
};

describe('buildRetakeLists（舊系統 process.php 重修／補修清單）', () => {
  it('預選不計算重修補修', () => {
    expect(
      buildRetakeLists({
        ...base,
        mode: '1',
        failed: ['4IM1001_1'],
        stdType: '1',
        mustCourses: ['4IM2001_1'],
      }),
    ).toEqual({ failed: [], needFill: [] });
  });

  it('重修清單：拿掉之後已及格的課，重複的只留一筆', () => {
    const r = buildRetakeLists({
      ...base,
      passed: ['4IM1001_1'],
      failed: ['4IM1001_1', '4IM1002_1', '4IM1002_1'],
    });
    expect(r.failed).toEqual(['4IM1002_1']);
  });

  it('重修清單：體育已修滿 4 門時拿掉體育重修', () => {
    const passed = ['1CC1998_1', '1CC1998_2', '1CC1999_1', '1CC1999_2'];
    const r = buildRetakeLists({
      ...base,
      passed,
      failed: ['1CC1998_3', '4IM1002_1'],
      gec: countGecPassed(passed),
    });
    expect(r.failed).toEqual(['4IM1002_1']);
    // 未滿 4 門則保留
    const r2 = buildRetakeLists({ ...base, failed: ['1CC1998_3'] });
    expect(r2.failed).toEqual(['1CC1998_3']);
  });

  it('補修只給轉學轉系生（1、2、9）', () => {
    expect(
      buildRetakeLists({ ...base, stdType: '0', mustCourses: ['4IM2001_1'] }).needFill,
    ).toEqual([]);
    expect(
      buildRetakeLists({ ...base, stdType: '2', mustCourses: ['4IM2001_1'] }).needFill,
    ).toEqual(['4IM2001_1', '1CC1998_1', '1CC1999_1']);
  });

  it('補修清單：拿掉體育、已及格、已修過同類的核心通識', () => {
    const passed = ['4IM2001_1', '1CC1220_1'];
    const r = buildRetakeLists({
      ...base,
      stdType: '1',
      passed,
      mustCourses: ['4IM2001_1', '4IM2002_1', '1CC1998_1', '1CC1220_1', '1CC1230_1'],
      gec: countGecPassed(passed),
    });
    expect(r.needFill).toEqual(['4IM2002_1', '1CC1230_1', '1CC1998_1', '1CC1999_1']);
  });

  it('與舊系統相同：原本有補修清單就補體育，即使過濾後已空；體育修滿則不補', () => {
    const r = buildRetakeLists({
      ...base,
      stdType: '1',
      passed: ['4IM2001_1'],
      mustCourses: ['4IM2001_1'],
    });
    expect(r.needFill).toEqual(['1CC1998_1', '1CC1999_1']);

    const pe = ['1CC1998_1', '1CC1998_2', '1CC1999_1', '1CC1999_2'];
    const done = buildRetakeLists({
      ...base,
      stdType: '1',
      passed: pe,
      mustCourses: ['4IM2001_1'],
      gec: countGecPassed(pe),
    });
    expect(done.needFill).toEqual(['4IM2001_1']);
  });

  it('沒有應修必修資料時不補體育', () => {
    expect(buildRetakeLists({ ...base, stdType: '1', mustCourses: [] }).needFill).toEqual([]);
  });
});

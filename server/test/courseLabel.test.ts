import { describe, expect, it } from 'vitest';
import { courseLabel, type LabelContext } from '../src/domain/courseLabel.js';

const ctx = (c: Partial<LabelContext> = {}): LabelContext => ({
  mode: '2',
  needFill: [],
  failed: [],
  ...c,
});
const course = (cosId: string, selType: string, cosTerm = '1', crossDisciplinary = false) => ({
  cosId,
  cosTerm,
  selType,
  crossDisciplinary,
});

// 案例對照舊系統 ajax_selcos_list.php get_cos_info
describe('courseLabel：課別', () => {
  it.each([
    ['E', 'elective', '專業選修', '[專選]'],
    ['H', 'elective', '通識選修', '[通選]'],
    ['R', 'retakeType', '重修', '[重修]'],
    ['S', 'makeUpType', '補修', '[補修]'],
    ['J', 'summer', '暑修', '[暑修]'],
    ['C', 'required', '專業必修', '[必修]'],
    ['A', 'basicGe', '基礎通識', '[通識]'],
    ['B', 'categoryGe', '分類通識', '[分通]'],
    ['P', 'coreGe', '核心通識必修', '[核通]'],
    ['T', 'liberalArts', '博雅通識', '[博通]'],
    ['X', 'other', '其他', '[選修]'],
  ])('%s → %s %s %s', (selType, kind, typeName, tag) => {
    expect(courseLabel(course('4IM1001', selType), ctx())).toEqual({ kind, typeName, tag });
  });
});

describe('courseLabel：體育、軍訓、跨域', () => {
  it('體育、軍訓只換標籤與顏色，類別名稱沿用課別', () => {
    expect(courseLabel(course('1CC1998', 'A'), ctx())).toEqual({
      kind: 'pe',
      typeName: '基礎通識',
      tag: '[體育]',
    });
    expect(courseLabel(course('1CC1997', 'A'), ctx())).toEqual({
      kind: 'military',
      typeName: '基礎通識',
      tag: '[軍訓]',
    });
  });

  it('跨域選修覆蓋課別與體育', () => {
    expect(courseLabel(course('1CC1998', 'A', '1', true), ctx())).toEqual({
      kind: 'cross',
      typeName: '跨域選修',
      tag: '[跨選]',
    });
  });
});

describe('courseLabel：補修、重修標示', () => {
  it('預選不標示補修、重修', () => {
    expect(
      courseLabel(course('4IM1001', 'C'), ctx({ mode: '1', failed: ['4IM1001_1'] })).kind,
    ).toBe('required');
  });

  it('一般課程需同課號同冊別', () => {
    expect(courseLabel(course('4IM1001', 'C'), ctx({ needFill: ['4IM1001_1'] })).kind).toBe(
      'makeUp',
    );
    expect(courseLabel(course('4IM1001', 'C', '2'), ctx({ needFill: ['4IM1001_1'] })).kind).toBe(
      'required',
    );
    expect(courseLabel(course('4IM1001', 'C'), ctx({ failed: ['4IM1001_1'] })).kind).toBe('retake');
  });

  it('核通、博雅比對前 6 碼（同類課程都標示）', () => {
    expect(courseLabel(course('1CC1201B', 'P'), ctx({ needFill: ['1CC1200_1'] })).kind).toBe(
      'makeUp',
    );
    expect(courseLabel(course('1CC1351', 'T', '2'), ctx({ failed: ['1CC1350_1'] })).kind).toBe(
      'retake',
    );
  });

  it('體育重修比對前 6 碼', () => {
    expect(courseLabel(course('1CC1999', 'A', '3'), ctx({ failed: ['1CC1998_2'] })).kind).toBe(
      'retake',
    );
  });

  it('同時符合補修與重修時，以重修為準（與舊系統相同）', () => {
    expect(
      courseLabel(course('4IM1001', 'C'), ctx({ needFill: ['4IM1001_1'], failed: ['4IM1001_1'] }))
        .kind,
    ).toBe('retake');
  });
});

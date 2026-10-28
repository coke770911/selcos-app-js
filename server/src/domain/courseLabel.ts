/**
 * 課程清單的類別標示（舊系統 ajax_selcos_list.php get_cos_info）。
 * 判斷順序與舊系統相同：課別 → 體育／軍訓 → 跨域 → 補修 → 重修，後者覆蓋前者。
 */
import type { CourseKind, CourseLabel, SelcosMode } from '@selcos/shared';

const BY_SEL_TYPE: Record<string, CourseLabel> = {
  E: { kind: 'elective', typeName: '專業選修', tag: '[專選]' },
  H: { kind: 'elective', typeName: '通識選修', tag: '[通選]' },
  R: { kind: 'retakeType', typeName: '重修', tag: '[重修]' },
  S: { kind: 'makeUpType', typeName: '補修', tag: '[補修]' },
  J: { kind: 'summer', typeName: '暑修', tag: '[暑修]' },
  C: { kind: 'required', typeName: '專業必修', tag: '[必修]' },
  A: { kind: 'basicGe', typeName: '基礎通識', tag: '[通識]' },
  B: { kind: 'categoryGe', typeName: '分類通識', tag: '[分通]' },
  P: { kind: 'coreGe', typeName: '核心通識必修', tag: '[核通]' },
  T: { kind: 'liberalArts', typeName: '博雅通識', tag: '[博通]' },
};
const OTHER: CourseLabel = { kind: 'other', typeName: '其他', tag: '[選修]' };

/** 體育、軍訓只換顏色與標籤，類別名稱沿用課別 */
const BY_GEC_CODE: Record<string, Pick<CourseLabel, 'kind' | 'tag'>> = {
  '1998': { kind: 'pe', tag: '[體育]' },
  '1999': { kind: 'pe', tag: '[體育]' },
  '1996': { kind: 'military', tag: '[軍訓]' },
  '1997': { kind: 'military', tag: '[軍訓]' },
};

const MAKE_UP: CourseLabel = { kind: 'makeUp', typeName: '補修', tag: '[補修]' };
const RETAKE: CourseLabel = { kind: 'retake', typeName: '重修', tag: '[重修]' };
const PE_PREFIXES = ['1CC1998', '1CC1999'];

export interface LabelCourse {
  cosId: string;
  cosTerm: string;
  selType: string;
  crossDisciplinary: boolean;
}

export interface LabelContext {
  mode: SelcosMode;
  /** 補修清單（課號_冊別） */
  needFill: string[];
  /** 重修清單（課號_冊別） */
  failed: string[];
}

export function courseLabel(course: LabelCourse, ctx: LabelContext): CourseLabel {
  const { cosId, cosTerm, selType } = course;
  let label: CourseLabel = { ...(BY_SEL_TYPE[selType] ?? OTHER) };

  if (cosId.slice(1, 3) === 'CC') {
    const gec = BY_GEC_CODE[cosId.slice(3, 7)];
    if (gec) label = { ...label, ...gec };
  }

  if (course.crossDisciplinary) label = { kind: 'cross', typeName: '跨域選修', tag: '[跨選]' };

  if (ctx.mode === '1') return label;

  const pk = `${cosId}_${cosTerm}`;
  const isCoreOrLiberal = selType === 'P' || selType === 'T';
  const prefix6 = cosId.slice(0, 6);

  // 補修：核通、博雅比對前 6 碼（同類即可），其他課程需同課號同冊別
  if (ctx.needFill.some((v) => (isCoreOrLiberal ? v.slice(0, 6) === prefix6 : v === pk))) {
    label = { ...MAKE_UP };
  }

  // 重修：同課號同冊別；核通、博雅、體育比對前 6 碼（同類即可）
  const isPE = PE_PREFIXES.includes(cosId.slice(0, 7));
  const retake = ctx.failed.some(
    (v) => v === pk || ((isCoreOrLiberal || isPE) && v.slice(0, 6) === prefix6),
  );
  if (retake) label = { ...RETAKE };

  return label;
}

export type { CourseKind };

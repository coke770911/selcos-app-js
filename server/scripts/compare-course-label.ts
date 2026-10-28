/**
 * 課程類別標示新舊比對（測試機，只讀）：npm run compare:label -w server -- [人數]
 *
 * legacyCosInfo 為舊系統 ajax_selcos_list.php get_cos_info 的逐行直譯（回傳舊色碼），
 * 與新系統 courseLabel 比較類別名稱、標籤與顏色（新系統的 kind 對回舊色碼）。
 */
import type { CourseKind, SelcosMode } from '@selcos/shared';
import { env } from '../src/config/env.js';
import { assertDbTargetAllowed } from '../src/config/dbGuard.js';
import { getPrisma, disconnectPrisma } from '../src/db/prisma.js';
import { authRepository } from '../src/db/repositories/authRepository.js';
import { selectionContextRepository } from '../src/db/repositories/selectionContextRepository.js';
import { courseRepository, type CourseRow } from '../src/db/repositories/courseRepository.js';
import { buildSelectionContext } from '../src/services/selectionContext.js';
import { courseLabel } from '../src/domain/courseLabel.js';

// ---------------- 舊系統 get_cos_info 逐行直譯 ----------------
function legacyCosInfo(
  c: { cos_id: string; cos_term: string; cos_sel_type: string; cos_crossDisciplinary: string },
  mode: SelcosMode,
  cos_need_fill: string[],
  cos_nopass: string[],
): [string, string, string] {
  let r1: string, r2: string, r3: string;
  switch (c.cos_sel_type) {
    case 'E':
      r1 = '專業選修';
      r2 = '#667799';
      r3 = '[專選]';
      break;
    case 'H':
      r1 = '通識選修';
      r2 = '#667799';
      r3 = '[通選]';
      break;
    case 'R':
      r1 = '重修';
      r2 = '#993399';
      r3 = '[重修]';
      break;
    case 'S':
      r1 = '補修';
      r2 = '#993333';
      r3 = '[補修]';
      break;
    case 'J':
      r1 = '暑修';
      r2 = '#CC99CC';
      r3 = '[暑修]';
      break;
    case 'C':
      r1 = '專業必修';
      r2 = '#000';
      r3 = '[必修]';
      break;
    case 'A':
      r1 = '基礎通識';
      r2 = '#669966';
      r3 = '[通識]';
      break;
    case 'B':
      r1 = '分類通識';
      r2 = '#666699';
      r3 = '[分通]';
      break;
    case 'P':
      r1 = '核心通識必修';
      r2 = '#996666';
      r3 = '[核通]';
      break;
    case 'T':
      r1 = '博雅通識';
      r2 = '#0A8';
      r3 = '[博通]';
      break;
    default:
      r1 = '其他';
      r2 = '#777777';
      r3 = '[選修]';
      break;
  }
  if (c.cos_id.substring(1, 3) === 'CC') {
    switch (c.cos_id.substring(3, 7)) {
      case '1998':
      case '1999':
        r2 = '#069';
        r3 = '[體育]';
        break;
      case '1996':
      case '1997':
        r2 = '#4f9fcf';
        r3 = '[軍訓]';
        break;
    }
  }
  if (c.cos_crossDisciplinary === '1') {
    r1 = '跨域選修';
    r2 = '#388E3C';
    r3 = '[跨選]';
  }
  if (mode !== '1') {
    if (cos_need_fill.length > 0) {
      for (const val of cos_need_fill) {
        let cos_id_temp = c.cos_id + '_' + c.cos_term;
        if (c.cos_sel_type === 'P' || c.cos_sel_type === 'T') {
          cos_id_temp = c.cos_id.substring(0, 7) + '_' + c.cos_term;
          if (val.substring(0, 6) === cos_id_temp.substring(0, 6)) {
            r1 = '補修';
            r2 = '#C0F';
            r3 = '[補修]';
          }
        } else if (val === cos_id_temp) {
          r1 = '補修';
          r2 = '#C0F';
          r3 = '[補修]';
        }
      }
    }
    if (cos_nopass.length > 0) {
      for (const val of cos_nopass) {
        if (val === c.cos_id + '_' + c.cos_term) {
          r1 = '重修';
          r2 = '#F00';
          r3 = '[重修]';
        }
        if (c.cos_sel_type === 'P' || c.cos_sel_type === 'T') {
          if (val.substring(0, 6) === c.cos_id.substring(0, 6)) {
            r1 = '重修';
            r2 = '#F00';
            r3 = '[重修]';
          }
        }
        if (['1CC1998', '1CC1999'].includes(c.cos_id.substring(0, 7))) {
          if (val.substring(0, 6) === c.cos_id.substring(0, 6)) {
            r1 = '重修';
            r2 = '#F00';
            r3 = '[重修]';
          }
        }
      }
    }
  }
  return [r1, r2, r3];
}
// ---------------- 直譯結束 ----------------

/** 新系統 kind 對回舊系統色碼 */
const OLD_COLOR: Record<CourseKind, string> = {
  elective: '#667799',
  retakeType: '#993399',
  makeUpType: '#993333',
  summer: '#CC99CC',
  required: '#000',
  basicGe: '#669966',
  categoryGe: '#666699',
  coreGe: '#996666',
  liberalArts: '#0A8',
  other: '#777777',
  pe: '#069',
  military: '#4f9fcf',
  cross: '#388E3C',
  makeUp: '#C0F',
  retake: '#F00',
};

await assertDbTargetAllowed(env.NODE_ENV, env.DB_HOST);
const total = Number(process.argv[2] ?? 40);
const p = getPrisma();
const setting = (await authRepository.findSetting(true))!;
const smtr = String(setting.sss_smtr).trim();

const ids = await p.$queryRaw<{ std_no: string }[]>`
  SELECT std_no FROM (
    SELECT TOP (${Math.ceil(total / 2)}) b.std_no FROM [OIT].[dbo].[dat_std_basic] b
    WHERE b.[state] = '01' AND EXISTS (SELECT 1 FROM [OIT].[dbo].[vtSelcos_yearScore] y WHERE y.std_no = b.std_no AND y.passState = 0)
    ORDER BY NEWID()) a
  UNION
  SELECT std_no FROM (
    SELECT TOP (${Math.floor(total / 2)}) b.std_no FROM [OIT].[dbo].[dat_std_basic] b
    WHERE b.[state] = '01' AND EXISTS (SELECT 1 FROM [OIT].[dbo].[dat_std_turn_s] t WHERE t.std_no = b.std_no)
    ORDER BY NEWID()) b`;

const courseCache = new Map<string, CourseRow[]>();
async function coursesOf(deptNo: string, year: string) {
  const k = `${deptNo}|${year}`;
  if (!courseCache.has(k))
    courseCache.set(k, await courseRepository.findByDept(smtr, deptNo, year));
  return courseCache.get(k)!;
}

let compared = 0;
const kinds = new Map<string, number>();
const mismatches: string[] = [];
for (const { std_no } of ids) {
  const st = await authRepository.findStudent(std_no.trim());
  if (!st) continue;
  for (const mode of ['1', '2'] as SelcosMode[]) {
    const built = await buildSelectionContext({
      repo: selectionContextRepository,
      student: st,
      setting: { ...setting, sss_type: mode },
      mode,
      isAdmin: true,
    });
    if (!built.ok) continue;
    const ctx = built.context;
    const deptNo = st.dept_no.trim();
    const geDept = `${deptNo[0]}CC`;
    for (const d of [deptNo, geDept]) {
      for (const year of ['1', '2', '3', '4']) {
        for (const row of await coursesOf(d, year)) {
          const c = {
            cos_id: row.cos_id.trim(),
            cos_term: row.cos_term.trim(),
            cos_sel_type: row.cos_sel_type.trim(),
            cos_crossDisciplinary: String(row.cos_crossDisciplinary ?? '').trim(),
          };
          const [r1, r2, r3] = legacyCosInfo(c, mode, ctx.needFill, ctx.failed);
          const now = courseLabel(
            {
              cosId: c.cos_id,
              cosTerm: c.cos_term,
              selType: c.cos_sel_type,
              crossDisciplinary: c.cos_crossDisciplinary === '1',
            },
            ctx,
          );
          compared++;
          kinds.set(now.tag, (kinds.get(now.tag) ?? 0) + 1);
          if (now.typeName !== r1 || now.tag !== r3 || OLD_COLOR[now.kind] !== r2) {
            mismatches.push(
              `${c.cos_id}_${c.cos_term} 模式${mode}：舊 ${r1}${r3}${r2}｜新 ${now.typeName}${now.tag}${OLD_COLOR[now.kind]}`,
            );
          }
        }
      }
    }
  }
}

console.log(`學生 ${ids.length} 人 × 預選／加退選，比對 ${compared} 門次課程（學期 ${smtr}）`);
console.log('標示分布：', Object.fromEntries([...kinds].sort((a, b) => b[1] - a[1])));
console.log(mismatches.length ? `不一致 ${mismatches.length} 筆：` : '全部一致 ✔');
for (const m of mismatches.slice(0, 20)) console.log(`  - ${m}`);
await disconnectPrisma();

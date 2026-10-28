/**
 * 新舊選課前置資料比對（測試機，只讀）：npm run compare:context -w server -- [人數]
 *
 * legacy* 為舊系統 process.php 的逐行直譯（保留 switch／陣列寫法、不重構），
 * 與新系統 buildSelectionContext 對同一批學生、三種選課模式、兩種開放設定比較。
 */
import { env } from '../src/config/env.js';
import { assertDbTargetAllowed } from '../src/config/dbGuard.js';
import { getPrisma, disconnectPrisma } from '../src/db/prisma.js';
import {
  authRepository,
  type SelcosSettingRow,
  type StudentRow,
} from '../src/db/repositories/authRepository.js';
import { selectionContextRepository as repo } from '../src/db/repositories/selectionContextRepository.js';
import { buildSelectionContext } from '../src/services/selectionContext.js';
import type { SelcosMode } from '@selcos/shared';

type Row = Record<string, unknown>;

// ---------------- 舊系統 process.php 逐行直譯 ----------------
function legacyContext(
  st: StudentRow,
  cfg: Row,
  mode: SelcosMode,
  scoreRows: { cosPK: string; passed: boolean }[],
  creditRow: { max_credit: number; min_credit: number } | null,
  mustRows: string[],
  questionnaireDone: boolean,
) {
  const s = (v: unknown) => String(v ?? '').trim();
  const typeNo = s(st.type_no);
  const state = s(st.state);
  const stdType = s(st.std_type);
  const smtr = s(cfg.sss_smtr);

  // 判斷選課系統開放條件分段年級條件及延修生
  let degree = Number(st.degree);
  if (typeNo === '2' || typeNo === 'R') degree = Number(st.degree) + 2;
  let degree_pass = false;
  if (state === '01') {
    if (cfg[`sss_${degree}degree`] !== undefined) {
      if (cfg[`sss_${degree}degree`] === 'Y') degree_pass = true;
    }
  }
  if (cfg.sss_delayDegree === 'Y' && state === '06') degree_pass = true;
  if (cfg.sss_chk_std_type === 'Y' && ['1', '2', '9'].includes(stdType)) degree_pass = true;
  if (!degree_pass) return { error: 'NOT_OPEN' as const };

  if (mode === '1') {
    if (cfg.chk_question === 'Y') {
      if (!questionnaireDone) return { error: 'QUESTIONNAIRE' as const };
    }
  }

  let nowdegree = Number(st.degree);
  if (mode === '1' && smtr.slice(-1) === '1') nowdegree += 1;
  if (nowdegree >= 5 && state === '06') nowdegree = 4;

  const cos_pass: string[] = [];
  let cos_nopass: string[] = [];
  for (const r of scoreRows) {
    if (r.passed) cos_pass.push(r.cosPK);
    else cos_nopass.push(r.cosPK);
  }

  const gec: Record<string, number> = {
    P1: 0,
    P2: 0,
    P3: 0,
    P4: 0,
    T1: 0,
    T2: 0,
    T3: 0,
    T4: 0,
    T5: 0,
    PE: 0,
    MT: 0,
    CH1: 0,
    CH2: 0,
    EG1: 0,
    EG2: 0,
    EG3: 0,
    EG4: 0,
    EG5: 0,
  };
  for (const val of cos_pass) {
    if (val.substring(1, 3) === 'CC') {
      switch (val.substring(3, 7)) {
        case '1001':
          if (val.substring(val.length - 1) === '1') gec.CH1! += 1;
          else gec.CH2! += 1;
          break;
        case '1003':
          if (val.substring(val.length - 1) === '1') gec.EG1! += 1;
          else gec.EG2! += 1;
          break;
        case '1119':
          gec.EG3! += 1;
          break;
        case '1110':
        case '1111':
        case '1112':
        case '1117':
          gec.EG4! += 1;
          break;
        case '1113':
        case '1114':
        case '1115':
        case '1116':
        case '1118':
          gec.EG5! += 1;
          break;
        case '1200':
          gec.P1! += 1;
          break;
        case '1220':
          gec.P2! += 1;
          break;
        case '1230':
          gec.P3! += 1;
          break;
        case '1250':
          gec.P4! += 1;
          break;
        case '1300':
        case '1310':
        case '1311':
          gec.T1! += 1;
          break;
        case '1320':
        case '1321':
          gec.T2! += 1;
          break;
        case '1330':
        case '1331':
          gec.T3! += 1;
          break;
        case '1340':
        case '1341':
          gec.T4! += 1;
          break;
        case '1350':
        case '1351':
          gec.T5! += 1;
          break;
        case '1998':
        case '1999':
          gec.PE! += 1;
          break;
        case '1996':
        case '1997':
          gec.MT! += 1;
          break;
      }
    }
  }

  let credit: { max: number; min: number };
  if (mode === '3') {
    credit = { max: Number(st.degree) >= 3 ? 15 : 10, min: 0 };
  } else if (creditRow) {
    credit = { max: Number(creditRow.max_credit), min: Number(creditRow.min_credit) };
    if (state === '06') credit.min = 0;
  } else {
    credit = { max: 8, min: 0 };
  }

  let cos_need_fill: string[] = [];
  if (mode === '2' || mode === '3') {
    if (['1', '2', '9'].includes(stdType)) cos_need_fill = [...mustRows];
    cos_nopass = cos_nopass.filter((val) => {
      if (cos_pass.includes(val)) return false;
      if (['1CC1998', '1CC1999'].includes(val.substring(0, 7)) && gec.PE! >= 4) return false;
      return true;
    });
    if (cos_need_fill.length > 0) {
      cos_need_fill = cos_need_fill.filter((val) => {
        if (['1CC1998', '1CC1999'].includes(val.substring(0, 7))) return false;
        if (cos_pass.includes(val)) return false;
        if (val.substring(0, 7) === '1CC1200' && gec.P1! >= 1) return false;
        if (val.substring(0, 7) === '1CC1220' && gec.P2! >= 1) return false;
        if (val.substring(0, 7) === '1CC1230' && gec.P3! >= 1) return false;
        if (val.substring(0, 7) === '1CC1250' && gec.P4! >= 1) return false;
        return true;
      });
      if (gec.PE! < 4) {
        cos_need_fill.push('1CC1998_1');
        cos_need_fill.push('1CC1999_1');
      }
    }
  }
  return { error: null, nowdegree, credit, gec, cos_pass, cos_nopass, cos_need_fill };
}
// ---------------- 直譯結束 ----------------

const sorted = (a: string[]) => [...a].sort();
const uniqSorted = (a: string[]) => [...new Set(a)].sort();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const mask = (stdNo: string) => `${stdNo.slice(0, 3)}***${stdNo.slice(-2)}`;

await assertDbTargetAllowed(env.NODE_ENV, env.DB_HOST);
const total = Number(process.argv[2] ?? 300);
const p = getPrisma();

const base = (
  await p.$queryRaw<Row[]>`
  SELECT TOP 1 * FROM [OIT].[dbo].[v_selcostime_setting] ORDER BY sss_beginTime DESC`
)[0]!;
const settings: [string, Row][] = [
  ['實際設定', base],
  [
    '只開三年級＋特殊身分',
    {
      ...base,
      sss_1degree: 'N',
      sss_2degree: 'N',
      sss_3degree: 'Y',
      sss_4degree: 'N',
      sss_5degree: 'N',
      sss_delayDegree: 'N',
      sss_chk_std_type: 'Y',
      chk_question: 'Y',
    },
  ],
];

const ids = await p.$queryRaw<{ std_no: string }[]>`
  SELECT std_no FROM (
    SELECT TOP (${Math.ceil(total * 0.7)}) std_no FROM [OIT].[dbo].[dat_std_basic]
    WHERE [state] IN ('01', '06') ORDER BY NEWID()) a
  UNION
  SELECT std_no FROM (
    SELECT TOP (${Math.floor(total * 0.3)}) b.std_no FROM [OIT].[dbo].[dat_std_basic] b
    WHERE b.[state] IN ('01', '06')
      AND (EXISTS (SELECT 1 FROM [OIT].[dbo].[dat_std_turn_s] t WHERE t.std_no = b.std_no)
        OR EXISTS (SELECT 1 FROM [OIT].[dbo].[dat_std_turn] t WHERE t.std_no = b.std_no AND apply = 'Y' AND cancel = 'N'))
    ORDER BY NEWID()) b`;

let compared = 0;
const mismatches: string[] = [];
const stats = {
  students: 0,
  special: 0,
  notOpen: 0,
  questionnaire: 0,
  failedLists: 0,
  needFill: 0,
};

for (const { std_no } of ids) {
  const st = await authRepository.findStudent(std_no.trim());
  if (!st) continue;
  stats.students++;
  if (['1', '2', '9'].includes(String(st.std_type).trim())) stats.special++;
  const stdNo = st.std_no.trim();
  const records = await repo.findCourseRecords(stdNo);

  for (const [settingName, cfg] of settings) {
    const questionnaireDone = await repo.hasQuestionnaire(
      String(cfg.sss_question_smtr ?? '').trim(),
      stdNo,
    );
    for (const mode of ['1', '2', '3'] as SelcosMode[]) {
      const setting = { ...cfg, sss_type: mode } as unknown as SelcosSettingRow;
      const smtr = String(cfg.sss_smtr).trim();
      let nowDegreeForCredit = Number(st.degree);
      if (mode === '1' && smtr.endsWith('1')) nowDegreeForCredit += 1;
      if (nowDegreeForCredit >= 5 && String(st.state).trim() === '06') nowDegreeForCredit = 4;
      const creditRow = await repo.findCreditLimit(String(st.type_no).trim(), nowDegreeForCredit);
      const must = await repo.findMustCourses({
        academicYear: String(st.Academic_year).trim(),
        deptNo: st.dept_no.trim(),
        team: String(st.team).trim(),
        smtr,
      });

      const legacy = legacyContext(st, cfg, mode, records, creditRow, must, questionnaireDone);
      const now = await buildSelectionContext({ repo, student: st, setting, mode, isAdmin: false });
      compared++;
      const tag = `${mask(stdNo)} ${settingName} 模式${mode}`;

      if (legacy.error) {
        if (legacy.error === 'NOT_OPEN') stats.notOpen++;
        else stats.questionnaire++;
        if (now.ok) mismatches.push(`${tag}：舊系統擋下（${legacy.error}），新系統放行`);
        continue;
      }
      if (!now.ok) {
        mismatches.push(`${tag}：舊系統放行，新系統擋下（${now.message}）`);
        continue;
      }
      const c = now.context;
      const diffs: string[] = [];
      if (c.currentDegree !== legacy.nowdegree)
        diffs.push(`年級 ${legacy.nowdegree}≠${c.currentDegree}`);
      if (!same(c.credit, legacy.credit))
        diffs.push(`學分 ${JSON.stringify(legacy.credit)}≠${JSON.stringify(c.credit)}`);
      if (!same(c.gec, legacy.gec)) diffs.push('通識次數不同');
      if (!same(sorted(c.passed), sorted(legacy.cos_pass))) diffs.push('及格清單不同');
      if (mode !== '1') {
        if (!same(uniqSorted(c.failed), uniqSorted(legacy.cos_nopass)))
          diffs.push(`重修 ${legacy.cos_nopass}≠${c.failed}`);
        if (!same(sorted(c.needFill), sorted(legacy.cos_need_fill)))
          diffs.push(`補修 ${legacy.cos_need_fill}≠${c.needFill}`);
        if (c.failed.length) stats.failedLists++;
        if (c.needFill.length) stats.needFill++;
      }
      if (diffs.length) mismatches.push(`${tag}：${diffs.join('；')}`);
    }
  }
}

console.log(
  `學生 ${stats.students} 人（轉學轉系等特殊身分 ${stats.special} 人），比對 ${compared} 組（2 種設定 × 3 種模式）`,
);
console.log(
  `其中：未開放 ${stats.notOpen} 組、問卷擋下 ${stats.questionnaire} 組、有重修清單 ${stats.failedLists} 組、有補修清單 ${stats.needFill} 組`,
);
console.log(mismatches.length ? `不一致 ${mismatches.length} 組：` : '全部一致 ✔');
for (const m of mismatches.slice(0, 30)) console.log(`  - ${m}`);
await disconnectPrisma();

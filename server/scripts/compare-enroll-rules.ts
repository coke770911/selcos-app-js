/**
 * 加退選規則新舊比對（測試機，只讀，不寫入任何選課資料）：npm run compare:enroll -w server -- [人數] [每人課數]
 *
 * legacyAdd / legacyDel 為舊系統 ajax_cos_add.php、ajax_cos_del.php 的逐行直譯（保留 session 陣列與迴圈寫法），
 * 對真實學生、真實本學期課表與課程，比較新系統 checkAdd / checkDrop 的結果（通過與否、訊息、寫入課別）。
 */
import type { SelcosMode } from '@selcos/shared';
import { env } from '../src/config/env.js';
import { assertDbTargetAllowed } from '../src/config/dbGuard.js';
import { getPrisma, disconnectPrisma } from '../src/db/prisma.js';
import { authRepository } from '../src/db/repositories/authRepository.js';
import { selectionContextRepository } from '../src/db/repositories/selectionContextRepository.js';
import {
  enrollmentRepository,
  type EnrollCourseRow,
  type SelectedRow,
} from '../src/db/repositories/enrollmentRepository.js';
import { buildSelectionContext, type SelectionContext } from '../src/services/selectionContext.js';
import { toRuleCourse } from '../src/services/enrollmentService.js';
import { checkAdd } from '../src/domain/addRules.js';
import { checkDrop } from '../src/domain/dropRules.js';
import { summarizeSelection } from '../src/domain/currentSelection.js';
import { gecType as gec_checkType } from '../src/domain/gec.js';
import { parsePeriods } from '../src/services/courseService.js';

type R = { ok: true; selType: string } | { ok: false; message: string };
const s = (v: unknown) => String(v ?? '').trim();

// ---------------- 舊系統 ajax_cos_add.php 逐行直譯 ----------------
function legacyAdd(
  cos: EnrollCourseRow,
  S: SelectionContext,
  selected: SelectedRow[],
  more: { more_flag: string }[] | null,
  clash: { cos_id: string; other_cos_id: string }[],
  postedCosId: string,
): R {
  // selcos_main.php 初始化的 session
  const selcos: Record<string, number> = {};
  const gec: Record<string, number> = { N: 0, P: 0, T: 0, PE: 0, MT: 0 };
  let creditNow = 0;
  const cos_now_sel: string[] = [];
  for (const r of selected) {
    gec[gec_checkType(s(r.sel_cos_id))]! += 1;
    creditNow += Number(r.cos_credit);
    for (const v of s(r.schd_time).split(',')) selcos[v] = 1;
    cos_now_sel.push(s(r.sel_cos_id));
  }
  const fail = (message: string): R => ({ ok: false, message });
  const cos_id = s(cos.cos_id),
    cos_term = s(cos.cos_term);
  let cos_sel_type = s(cos.cos_sel_type);

  if (['1CC1998Z'].includes(cos_id)) return fail('此課程為特殊課程無法加選！');
  if (cos_id.substring(0, 6) === '1CC132') {
    if (Number(S.student.academicYear) >= 112) return fail('此課程非課綱內通識，無法加選！');
  }
  if (S.rules.firstYearCoursesBlocked) {
    if (s(cos.cos_year) === '1') return fail('新學年第一學期無法加選一年級課程！');
  }
  if (cos_now_sel.length > 0) {
    if (!(gec_checkType(cos_id) === 'PE')) {
      for (const val of cos_now_sel) if (val === cos_id) return fail('您這學期課表已選過此課程！');
    }
    if (cos_sel_type === 'P') {
      for (const val of cos_now_sel) {
        if (val.substring(0, 6) === cos_id.substring(0, 6))
          return fail('您這學期課表已選過相同核心通識課程！');
      }
    }
  }
  const time_arr = s(cos.schd_time).split(',');
  for (const val of time_arr) if (selcos[val] === 1) return fail('此課程與您目前課表衝堂！');
  if (creditNow + Number(cos.cos_credit) > S.credit.max)
    return fail('無法加選課程，學分已超出上限！');
  for (const val of S.passed) {
    if (gec_checkType(val) !== 'PE') {
      if (val === cos_id + '_' + cos_term) return fail('此課程你已修過並及格通過！');
    }
  }
  let PECOUNT = 1;
  if (!S.rules.checkPrerequisite && S.currentDegree >= 3) PECOUNT = 2;
  if (gec_checkType(cos_id) === 'PE') {
    if (S.gec.PE >= 4) return fail('您已修' + S.gec.PE + '門體育課程！，不需要再選體育！');
    if (gec.PE! + S.gec.PE >= 4)
      return fail('您已修' + S.gec.PE + '門體育課程，最多修畢四門體育！');
    if (gec.PE! >= PECOUNT) return fail('您這學期已選過' + gec.PE + '門體育課程！');
  }
  if (cos_sel_type === 'P') {
    switch (cos_id.substring(0, 7)) {
      case '1CC1200':
        if (S.gec.P1 >= 1) return fail('您已選過核心通識[知識創新]類！');
        break;
      case '1CC1220':
        if (S.gec.P2 >= 1) return fail('您已選過核心通識[歷史文化]類！');
        break;
      case '1CC1230':
        if (S.gec.P3 >= 1) return fail('您已選過核心通識[經典閱讀]類！');
        break;
      case '1CC1250':
        if (S.gec.P4 >= 1) return fail('您已選過核心通識[公民素養]類！');
        break;
    }
  }
  if (cos_sel_type === 'T') {
    const countT = S.gec.T1 + S.gec.T2 + S.gec.T3 + S.gec.T4 + S.gec.T5;
    const academicYear = Number(S.student.academicYear) || 0;
    if (academicYear >= 112) {
      if (countT >= 4)
        return fail('您已修過四門博雅通識不需再選，請確認博雅通識類別是否已修過二類以上！');
      if (countT + gec.T! >= 4)
        return fail('您已修過博雅通識與目前加選的博雅通識，已達四門博雅通識無法再加選！');
    } else {
      if (countT >= 5)
        return fail('您已修過五門博雅通識不需再選，請確認博雅通識類別是否已修過三類以上！');
      if (countT + gec.T! >= 5)
        return fail('您已修過博雅通識與目前加選的博雅通識，已達五門博雅通識無法再加選！');
    }
  }
  if (S.rules.checkStudentMax) {
    if (s(cos.chk_max_num) === 'Y') {
      if (Number(cos.sel_total) >= Number(cos.max_std))
        return fail('此課程人數已達上限，不可再加選！');
    }
  }
  let cos_check = true;
  if (S.mode !== '1') {
    let cos_id_check = cos_id + '_' + cos_term;
    const no_pass_changCos = [
      '1CC120',
      '1CC122',
      '1CC123',
      '1CC125',
      '1CC131',
      '1CC132',
      '1CC133',
      '1CC134',
      '1CC135',
    ];
    if (S.needFill.length > 0) {
      for (const val of S.needFill) {
        if (cos_id_check === val) {
          cos_check = false;
          cos_sel_type = 'S';
          break;
        }
      }
    }
    if (S.failed.length > 0) {
      for (const val of S.failed) {
        if (cos_id_check === val) {
          cos_check = false;
          cos_sel_type = 'R';
          break;
        }
        if (cos_sel_type === 'P' || cos_sel_type === 'T') {
          cos_id_check = cos_id.substring(0, 7) + '_' + cos_term;
          if (no_pass_changCos.includes(val.substring(0, 6))) {
            if (cos_id_check.substring(0, 6) === val.substring(0, 6)) {
              cos_check = false;
              cos_sel_type = 'R';
              break;
            }
          }
        }
        if (['1CC1998', '1CC1999'].includes(cos_id.substring(0, 7))) {
          if (cos_id.substring(0, 6) === val.substring(0, 6)) {
            cos_check = false;
            cos_sel_type = 'R';
            break;
          }
        }
      }
    }
  }
  if (cos_check) {
    if (s(cos.chk_can_ins) !== 'Y') return fail('此課程設定不可加選。');
    if (s(cos.chk_college) === 'Y') {
      if (S.student.typeNo !== s(cos.cos_dept_no).substring(0, 1))
        return fail('學制相同才能加選！');
    } else {
      if (S.rules.checkDegree || S.student.state !== '06') {
        const over = Number(cos.chk_over_year),
          under = Number(cos.chk_under_year);
        if (!(S.currentDegree > over && S.currentDegree < under)) {
          return fail(
            over + 1 === under - 1
              ? '此課程限定' + (over + 1) + '年級同學才可加選'
              : '此課程限定' + (over + 1) + '年級到' + (under - 1) + '年級的同學才可加選',
          );
        }
      }
      if (s(cos.chk_dept) === 'Y') {
        if (S.student.deptNo !== s(cos.cos_dept)) return fail('同系才能加選！');
      }
      if (s(cos.chk_selcos_dept) === 'Y') {
        if (more && more.length) {
          for (const m of more) {
            if (!(s(m.more_flag) === 'Y'))
              return fail(
                '此課程目前只開放限定系所、年級、班級選修，詳細請看通識中心與教務行政組公告！',
              );
          }
        } else return fail('此課程目前不開放您的系所選修！');
      }
    }
  }
  if (clash.length) {
    for (const val of clash) {
      const check_cos_id = postedCosId === s(val.cos_id) ? s(val.other_cos_id) : s(val.cos_id);
      for (const cos_pass of S.passed) {
        if (cos_pass.split('_')[0] === check_cos_id)
          return fail('重複選課！此課程已在其他學期選過！');
      }
    }
  }
  if (S.mode === '3') cos_sel_type = 'J';
  return { ok: true, selType: cos_sel_type };
}

// ---------------- 舊系統 ajax_cos_del.php 逐行直譯 ----------------
function legacyDel(cos: EnrollCourseRow, S: SelectionContext, creditNow: number): R {
  const fail = (message: string): R => ({ ok: false, message });
  if (s(cos.chk_can_del) === 'N') {
    let cos_check = true;
    const cos_id_check = s(cos.cos_id) + '_' + s(cos.cos_term);
    if (S.mode !== '1') {
      for (const val of S.failed)
        if (cos_id_check === val) {
          cos_check = false;
          break;
        }
      for (const val of S.needFill)
        if (cos_id_check === val) {
          cos_check = false;
          break;
        }
    }
    if (cos_check) return fail('此課程設定不可退選。');
  }
  if (S.student.state !== '06') {
    if (S.rules.checkStudentMin) {
      if (s(cos.chk_min_num) === 'Y') {
        if (Number(cos.sel_total) <= Number(cos.min_std))
          return fail('此課程人數低於下限，不可退選。');
      }
    }
    if (S.rules.courseMinCanDrop) {
      if (Number(cos.sel_total) === Number(cos.min_std))
        return fail('此課程需大於課程人數下限，才可以退選。');
    }
  }
  if (S.mode === '2' || S.mode === '3') {
    if (S.credit.min > creditNow - Number(cos.cos_credit) && S.credit.min !== 0) {
      return fail('退選此課程將低於規定學分，不可退選。');
    }
  }
  return { ok: true, selType: '' };
}
// ---------------- 直譯結束 ----------------

const same = (a: R, b: R) => JSON.stringify(a) === JSON.stringify(b);
const mask = (stdNo: string) => `${stdNo.slice(0, 3)}***${stdNo.slice(-2)}`;

await assertDbTargetAllowed(env.NODE_ENV, env.DB_HOST);
const total = Number(process.argv[2] ?? 40);
const perStudent = Number(process.argv[3] ?? 40);
const p = getPrisma();
const baseSetting = (await authRepository.findSetting(true))!;
const smtr = s(baseSetting.sss_smtr);

// 有本學期選課紀錄的學生為主（才測得到衝堂、學分、退選）
const ids = await p.$queryRaw<{ std_no: string }[]>`
  SELECT TOP (${total}) b.std_no FROM [OIT].[dbo].[dat_std_basic] b
  WHERE b.[state] IN ('01','06')
    AND EXISTS (SELECT 1 FROM [OIT].[dbo].[cos_smtr_stdregi] r WHERE r.sel_std_no = b.std_no AND r.sel_smtr = ${smtr})
  ORDER BY NEWID()`;

let addCompared = 0,
  dropCompared = 0;
const outcomes = new Map<string, number>();
const mismatches: string[] = [];

for (const { std_no } of ids) {
  const st = await authRepository.findStudent(std_no.trim());
  if (!st) continue;
  const stdNo = st.std_no.trim();
  for (const mode of ['1', '2', '3'] as SelcosMode[]) {
    const setting = {
      ...baseSetting,
      sss_type: mode,
      chk_sel_stdnum_max: 'Y',
      chk_sel_stdnum_min: 'Y',
    };
    const built = await buildSelectionContext({
      repo: selectionContextRepository,
      student: st,
      setting,
      mode,
      isAdmin: true,
    });
    if (!built.ok) continue;
    const ctx = built.context;

    // 唯讀：不帶鎖的交易，只查資料、不寫入
    await enrollmentRepository.withLocks([], async (tx) => {
      const selected = await tx.findSelected(smtr, stdNo);
      const current = summarizeSelection(
        selected.map((r) => ({
          cosId: s(r.sel_cos_id),
          credit: Number(r.cos_credit),
          periods: parsePeriods(r.schd_time),
        })),
      );

      // 加選：本系 + 通識各年級課程中抽樣
      const candidates = await p.$queryRaw<
        { cos_id: string; cos_class: string; cos_term: string }[]
      >`
        SELECT TOP (${perStudent}) cos_id, cos_class, cos_term FROM [OIT].[dbo].[tSelcos_tmpSmtrcos]
        WHERE cos_smtr = ${smtr} AND (cos_dept_no = ${st.dept_no} OR cos_dept_no LIKE ${st.dept_no.trim().slice(0, 1) + 'CC%'})
        ORDER BY NEWID()`;
      for (const c of candidates) {
        const key = { smtr, cosId: s(c.cos_id), cosClass: s(c.cos_class), cosTerm: s(c.cos_term) };
        const row = (await tx.findCourse(key))!;
        const course = toRuleCourse(row);
        const moreRaw = course.chkSelcosDept
          ? await tx.findMoreDept(key, {
              deptNo: ctx.student.deptNo,
              class: ctx.student.class,
              degree: ctx.currentDegree,
            })
          : null;
        const clashRows = await p.$queryRaw<{ cos_id: string; other_cos_id: string }[]>`
          SELECT cos_id, other_cos_id FROM [OIT].[dbo].[cos_clash] WHERE cos_id = ${key.cosId} OR other_cos_id = ${key.cosId}`;
        const legacy = legacyAdd(row, ctx, selected, moreRaw, clashRows, key.cosId);
        const now = checkAdd({
          course,
          ctx,
          current,
          moreDept: moreRaw?.map((m) => ({ moreFlag: s(m.more_flag) })) ?? null,
          clashCosIds: await tx.findClashCosIds(key.cosId),
        });
        addCompared++;
        const tag = now.ok ? `加選通過(${now.selType})` : now.message;
        outcomes.set(tag, (outcomes.get(tag) ?? 0) + 1);
        if (!same(legacy, now))
          mismatches.push(
            `加選 ${mask(stdNo)} 模式${mode} ${key.cosId}：舊 ${JSON.stringify(legacy)}｜新 ${JSON.stringify(now)}`,
          );
      }

      // 退選：學生目前課表中的每一門（新系統多了「是否在課表中」，這裡都是在課表中的課）
      for (const r of selected) {
        const key = {
          smtr,
          cosId: s(r.sel_cos_id),
          cosClass: s(r.sel_cos_class),
          cosTerm: s(r.sel_cos_term),
        };
        const row = await tx.findCourse(key);
        if (!row) continue;
        const legacy = legacyDel(row, ctx, current.credit);
        const nowR = checkDrop({
          course: toRuleCourse(row),
          ctx,
          currentCredit: current.credit,
          enrolled: true,
        });
        const now: R = nowR.ok ? { ok: true, selType: '' } : nowR;
        dropCompared++;
        const tag = now.ok ? '退選通過' : now.message;
        outcomes.set(tag, (outcomes.get(tag) ?? 0) + 1);
        if (!same(legacy, now))
          mismatches.push(
            `退選 ${mask(stdNo)} 模式${mode} ${key.cosId}：舊 ${JSON.stringify(legacy)}｜新 ${JSON.stringify(now)}`,
          );
      }
    });
  }
}

console.log(
  `學生 ${ids.length} 人 × 3 種模式：加選比對 ${addCompared} 次、退選比對 ${dropCompared} 次（學期 ${smtr}）`,
);
console.log('結果分布：');
for (const [k, v] of [...outcomes].sort((a, b) => b[1] - a[1]))
  console.log(`  ${v.toString().padStart(6)}  ${k}`);
console.log(mismatches.length ? `不一致 ${mismatches.length} 筆：` : '全部一致 ✔');
for (const m of mismatches.slice(0, 20)) console.log(`  - ${m}`);
await disconnectPrisma();

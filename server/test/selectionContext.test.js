import { describe, expect, it, vi } from 'vitest';
import { buildSelectionContext } from '../src/services/selectionContext.js';

import { NOT_OPEN_MESSAGE, QUESTIONNAIRE_MESSAGE } from '../src/domain/eligibility.js';

/**
 * @import { SelectionContextRepository } from '../src/db/repositories/selectionContextRepository.js'
 * @import { SelcosSettingRow, StudentRow } from '../src/db/repositories/authRepository.js'
 */

/** @type {StudentRow} */
const student = {
  std_no: '112A0001  ',
  chi_name: '王小明',
  type_no: '4 ',
  degree: '2',
  class: 'A',
  state: '01',
  std_type: '0',
  team: '0 ',
  dept_no: '4IM ',
  entry_year: '112',
  Academic_year: '112',
  dept_name_s: '資管系',
  grad_year: '4',
};

/** @type {SelcosSettingRow} */
const setting = {
  sss_type: '2',
  sss_smtr: '1151',
  sss_state: true,
  sss_beginTime: new Date(),
  sss_endTime: new Date(),
  sss_2degree: 'Y',
  chk_question: 'N',
  chk_sel_cosmin_can_del: 'N',
  chk_sel_stdnum_min: 'Y',
  chk_sel_stdnum_max: 'Y',
  chk_pre_cos: 'N',
  sss_1degreeNoAgree: 'N',
  chk_access_degree: 'Y',
};

/** @param {Partial<SelectionContextRepository>} [overrides] */
function fakeRepo(overrides = {}) {
  /** @type {SelectionContextRepository} */
  const repo = {
    findCourseRecords: vi.fn(async () => [
      { cosPK: '4IM1001_1', passed: false },
      { cosPK: '1CC1998_1', passed: true },
      { cosPK: '1CC1998_1', passed: true },
      { cosPK: '4IM1002_1', passed: true },
    ]),
    findCreditLimit: vi.fn(async () => ({ max_credit: 25, min_credit: 15 })),
    findMustCourses: vi.fn(async () => ['4IM2001_1']),
    hasQuestionnaire: vi.fn(async () => false),
    ...overrides,
  };
  return repo;
}

describe('buildSelectionContext', () => {
  it('組出年級、學分上下限、及格／重修清單、通識次數與檢查開關', async () => {
    const repo = fakeRepo();
    const r = await buildSelectionContext({ repo, student, setting, mode: '2', isAdmin: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.context).toMatchObject({
      stdNo: '112A0001',
      smtr: '1151',
      currentDegree: 2,
      credit: { max: 25, min: 15 },
      failed: ['4IM1001_1'],
      needFill: [],
      student: { typeNo: '4', deptNo: '4IM', team: '0' },
      rules: { checkStudentMin: true, checkStudentMax: true, courseMinCanDrop: false },
    });
    // 同一門體育修兩次算 2 次
    expect(r.context.gec.PE).toBe(2);
    expect(repo.findCreditLimit).toHaveBeenCalledWith('4', 2);
    // 一般生不查補修
    expect(repo.findMustCourses).not.toHaveBeenCalled();
  });

  it('未開放的年級回傳舊系統訊息，且不再查修課資料', async () => {
    const repo = fakeRepo();
    const r = await buildSelectionContext({
      repo,
      student: { ...student, degree: '3' },
      setting,
      mode: '2',
      isAdmin: false,
    });
    expect(r).toEqual({ ok: false, message: NOT_OPEN_MESSAGE });
    expect(repo.findCourseRecords).not.toHaveBeenCalled();
  });

  it('預選要求問卷時以 sss_question_smtr 查詢；管理員代登不查', async () => {
    const repo = fakeRepo();
    const q = { ...setting, chk_question: 'Y', sss_question_smtr: '1142' };
    const r = await buildSelectionContext({ repo, student, setting: q, mode: '1', isAdmin: false });
    expect(r).toEqual({ ok: false, message: QUESTIONNAIRE_MESSAGE });
    expect(repo.hasQuestionnaire).toHaveBeenCalledWith('1142', '112A0001');

    const admin = fakeRepo();
    const ra = await buildSelectionContext({
      repo: admin,
      student,
      setting: q,
      mode: '1',
      isAdmin: true,
    });
    expect(ra.ok).toBe(true);
    expect(admin.hasQuestionnaire).not.toHaveBeenCalled();
  });

  it('預選第一學期以升級後的年級查學分限制', async () => {
    const repo = fakeRepo();
    const r = await buildSelectionContext({
      repo,
      student,
      setting: { ...setting, sss_type: '1', sss_3degree: 'Y' },
      mode: '1',
      isAdmin: false,
    });
    expect(r.ok && r.context.currentDegree).toBe(3);
    expect(repo.findCreditLimit).toHaveBeenCalledWith('4', 3);
  });

  it('轉學轉系生在加退選查應修必修並產生補修清單', async () => {
    const repo = fakeRepo();
    const r = await buildSelectionContext({
      repo,
      student: { ...student, std_type: '1' },
      setting,
      mode: '2',
      isAdmin: false,
    });
    expect(repo.findMustCourses).toHaveBeenCalledWith({
      academicYear: '112',
      deptNo: '4IM',
      team: '0',
      smtr: '1151',
    });
    expect(r.ok && r.context.needFill).toEqual(['4IM2001_1', '1CC1998_1', '1CC1999_1']);
  });

  it('暑修不查學分設定表', async () => {
    const repo = fakeRepo();
    const r = await buildSelectionContext({ repo, student, setting, mode: '3', isAdmin: false });
    expect(r.ok && r.context.credit).toEqual({ max: 10, min: 0 });
    expect(repo.findCreditLimit).not.toHaveBeenCalled();
  });
});

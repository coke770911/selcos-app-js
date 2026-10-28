import { describe, expect, it } from 'vitest';
import {
  checkEligibility,
  currentDegree,
  isOpenForStudent,
  NOT_OPEN_MESSAGE,
  QUESTIONNAIRE_MESSAGE,
  type EligibilitySetting,
  type EligibilityStudent,
} from '../src/domain/eligibility.js';

const closed: EligibilitySetting = {
  sss_smtr: '1151',
  sss_1degree: 'N',
  sss_2degree: 'N',
  sss_3degree: 'N',
  sss_4degree: 'N',
  sss_5degree: 'N',
  sss_delayDegree: 'N',
  sss_chk_std_type: 'N',
  chk_question: 'N',
};
const student = (s: Partial<EligibilityStudent> = {}): EligibilityStudent => ({
  degree: 2,
  typeNo: '4',
  state: '01',
  stdType: '0',
  ...s,
});

describe('isOpenForStudent（舊系統 process.php 年級開放條件）', () => {
  it('在學生依年級欄位判斷', () => {
    expect(isOpenForStudent(student(), { ...closed, sss_2degree: 'Y' })).toBe(true);
    expect(isOpenForStudent(student(), { ...closed, sss_3degree: 'Y' })).toBe(false);
  });

  it('二技（type_no 2、R）年級 +2 後對照', () => {
    expect(
      isOpenForStudent(student({ typeNo: '2', degree: 1 }), { ...closed, sss_3degree: 'Y' }),
    ).toBe(true);
    expect(
      isOpenForStudent(student({ typeNo: 'R', degree: 3 }), { ...closed, sss_5degree: 'Y' }),
    ).toBe(true);
    expect(
      isOpenForStudent(student({ typeNo: '2', degree: 1 }), { ...closed, sss_1degree: 'Y' }),
    ).toBe(false);
  });

  it('延修生（06）不看年級，只看 sss_delayDegree', () => {
    const delayed = student({ state: '06', degree: 5 });
    expect(isOpenForStudent(delayed, { ...closed, sss_5degree: 'Y' })).toBe(false);
    expect(isOpenForStudent(delayed, { ...closed, sss_delayDegree: 'Y' })).toBe(true);
  });

  it('轉學轉系等特殊身分（1、2、9）在 sss_chk_std_type=Y 時可登入', () => {
    for (const stdType of ['1', '2', '9']) {
      expect(isOpenForStudent(student({ stdType }), { ...closed, sss_chk_std_type: 'Y' })).toBe(
        true,
      );
    }
    expect(isOpenForStudent(student({ stdType: '0' }), { ...closed, sss_chk_std_type: 'Y' })).toBe(
      false,
    );
  });
});

describe('checkEligibility', () => {
  const open = { ...closed, sss_2degree: 'Y' };

  it('未開放時回傳舊系統訊息；管理員代登不受限', () => {
    expect(
      checkEligibility({ student: student(), setting: closed, mode: '2', isAdmin: false }),
    ).toBe(NOT_OPEN_MESSAGE);
    expect(
      checkEligibility({ student: student(), setting: closed, mode: '2', isAdmin: true }),
    ).toBeNull();
  });

  it('只有預選且 chk_question=Y 才檢查問卷', () => {
    const q = { ...open, chk_question: 'Y' };
    expect(checkEligibility({ student: student(), setting: q, mode: '1', isAdmin: false })).toBe(
      QUESTIONNAIRE_MESSAGE,
    );
    expect(
      checkEligibility({
        student: student(),
        setting: q,
        mode: '1',
        isAdmin: false,
        questionnaireDone: true,
      }),
    ).toBeNull();
    expect(
      checkEligibility({ student: student(), setting: q, mode: '2', isAdmin: false }),
    ).toBeNull();
    expect(
      checkEligibility({ student: student(), setting: q, mode: '1', isAdmin: true }),
    ).toBeNull();
  });
});

describe('currentDegree（虛擬年級）', () => {
  it('預選且第一學期年級 +1；其他情況不變', () => {
    expect(currentDegree({ degree: 2, state: '01' }, '1', '1151')).toBe(3);
    expect(currentDegree({ degree: 2, state: '01' }, '1', '1152')).toBe(2);
    expect(currentDegree({ degree: 2, state: '01' }, '2', '1151')).toBe(2);
  });

  it('延修生最多以 4 年級計算；一般生不受限', () => {
    expect(currentDegree({ degree: 5, state: '06' }, '2', '1151')).toBe(4);
    expect(currentDegree({ degree: 4, state: '06' }, '1', '1151')).toBe(4);
    expect(currentDegree({ degree: 4, state: '01' }, '1', '1151')).toBe(5);
  });
});

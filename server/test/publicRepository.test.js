import { describe, expect, it } from 'vitest';
import { toScheduleItem } from '../src/db/repositories/publicRepository.js';

describe('開放時段公告', () => {
  it('依 Y 欄位列出可登入的學制年級', () => {
    expect(
      toScheduleItem({
        open_datetime: '2026-10-22 09:00:00',
        end_datetime: '2026-10-23 17:00:00',
        sss_1degree: 'N',
        sss_2degree: 'Y',
        sss_3degree: 'N',
        sss_4degree: 'N',
        sss_5degree: 'N',
        sss_delayDegree: 'Y',
      }),
    ).toEqual({
      begin: '2026-10-22 09:00:00',
      end: '2026-10-23 17:00:00',
      groups: ['四技二年級、碩班二年級', '延修生'],
    });
  });
});

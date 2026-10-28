import { describe, expect, it } from 'vitest';
import { summarizeSelection } from '../src/domain/currentSelection.js';

describe('summarizeSelection（舊系統 selcos_main.php 課表初始化）', () => {
  it('加總學分、合併節次、依通識類型計次', () => {
    const s = summarizeSelection([
      { cosId: '4IM2001', credit: 3, periods: ['101', '102'] },
      { cosId: '1CC1998', credit: 0, periods: ['301'] },
      { cosId: '1CC1351', credit: 2, periods: ['501', '502'] },
    ]);
    expect(s.credit).toBe(5);
    expect(s.cosIds).toEqual(['4IM2001', '1CC1998', '1CC1351']);
    expect([...s.periods].sort()).toEqual(['101', '102', '301', '501', '502']);
    expect(s.gec).toEqual({ P: 0, T: 1, PE: 1, MT: 0, N: 1 });
  });

  it('空課表', () => {
    const s = summarizeSelection([]);
    expect(s.credit).toBe(0);
    expect(s.periods.size).toBe(0);
  });
});

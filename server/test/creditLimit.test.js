import { describe, expect, it } from 'vitest';
import { creditLimit } from '../src/domain/creditLimit.js';

const row = { max_credit: 25, min_credit: 15 };

describe('creditLimit（舊系統 process.php 學分上下限）', () => {
  it('暑修：學籍 3 年級以上上限 15，其餘 10，無下限（不看設定表）', () => {
    expect(creditLimit({ mode: '3', degree: 3, state: '01', row })).toEqual({ max: 15, min: 0 });
    expect(creditLimit({ mode: '3', degree: 2, state: '01', row })).toEqual({ max: 10, min: 0 });
  });

  it('預選、加退選依設定表', () => {
    expect(creditLimit({ mode: '2', degree: 2, state: '01', row })).toEqual({ max: 25, min: 15 });
    expect(creditLimit({ mode: '1', degree: 2, state: '01', row })).toEqual({ max: 25, min: 15 });
  });

  it('延修生無下限', () => {
    expect(creditLimit({ mode: '2', degree: 5, state: '06', row })).toEqual({ max: 25, min: 0 });
  });

  it('查不到設定時預設上限 8、下限 0', () => {
    expect(creditLimit({ mode: '2', degree: 2, state: '01', row: null })).toEqual({
      max: 8,
      min: 0,
    });
  });
});

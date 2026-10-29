import { describe, expect, it } from 'vitest';
import { countGecPassed, gecPassCategory, gecType, liberalArtsPassed } from '../src/domain/gec.js';

// 案例對照舊系統 fun_tools.php gec_checkType 與 process.php 的通識計次 switch
describe('gecType（舊系統 gec_checkType）', () => {
  it.each([
    ['1CC1200A', 'P'],
    ['1CC1220', 'P'],
    ['1CC1230', 'P'],
    ['1CC1250', 'P'],
    ['1CC1300', 'T'],
    ['1CC1310', 'T'],
    ['1CC1321B', 'T'],
    ['1CC1351', 'T'],
    ['1CC1998', 'PE'],
    ['1CC1999', 'PE'],
    ['1CC2998', 'PE'],
    ['1CC1996', 'MT'],
    ['1CC2029', 'MT'],
    ['1CC1001', 'N'],
    ['4IM1001', 'N'],
    ['1XC1200', 'N'],
  ])('%s → %s', (cosId, expected) => {
    expect(gecType(cosId)).toBe(expected);
  });

  it('與舊系統相同：1311 計入博雅 T1 已修次數，但選課時不視為博雅', () => {
    expect(gecType('1CC1311')).toBe('N');
    expect(gecPassCategory('1CC1311_1')).toBe('T1');
  });
});

describe('gecPassCategory（舊系統 process.php 通識計次）', () => {
  it.each([
    ['1CC1001_1', 'CH1'],
    ['1CC1001_2', 'CH2'],
    ['1CC1003_1', 'EG1'],
    ['1CC1003_2', 'EG2'],
    ['1CC1119_1', 'EG3'],
    ['1CC1110_1', 'EG4'],
    ['1CC1117_1', 'EG4'],
    ['1CC1113_1', 'EG5'],
    ['1CC1118_1', 'EG5'],
    ['1CC1200_1', 'P1'],
    ['1CC1220_1', 'P2'],
    ['1CC1230_1', 'P3'],
    ['1CC1250_1', 'P4'],
    ['1CC1300_1', 'T1'],
    ['1CC1320_1', 'T2'],
    ['1CC1331_1', 'T3'],
    ['1CC1340_1', 'T4'],
    ['1CC1350_1', 'T5'],
    ['1CC1998_1', 'PE'],
    ['1CC1999_2', 'PE'],
    ['1CC1996_1', 'MT'],
  ])('%s → %s', (cosPK, expected) => {
    expect(gecPassCategory(cosPK)).toBe(expected);
  });

  it('不計次的課號回傳 null（例如 2998 體育、2023 軍訓、非通識）', () => {
    expect(gecPassCategory('1CC2998_1')).toBeNull();
    expect(gecPassCategory('1CC2023_1')).toBeNull();
    expect(gecPassCategory('4IM1200_1')).toBeNull();
  });
});

describe('countGecPassed', () => {
  it('依已通過課程計次，博雅總數為 T1–T5 加總', () => {
    const counts = countGecPassed([
      '1CC1001_1',
      '1CC1001_2',
      '1CC1998_1',
      '1CC1999_1',
      '1CC1300_1',
      '1CC1351_1',
      '4IM1001_1',
    ]);
    expect(counts).toMatchObject({ CH1: 1, CH2: 1, PE: 2, T1: 1, T5: 1, P1: 0 });
    expect(liberalArtsPassed(counts)).toBe(2);
  });
});

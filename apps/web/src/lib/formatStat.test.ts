import { describe, expect, it } from 'vitest';
import { decimalsOf, formatStat } from './formatStat';

describe('formatStat', () => {
  it('uses Indian digit grouping', () => {
    expect(formatStat(1234567, 0)).toBe('12,34,567');
  });

  it('keeps the source precision and suffix', () => {
    expect(formatStat(12.5, 1, '%')).toBe('12.5%');
    expect(formatStat(3, 0, '%')).toBe('3%');
  });

  it('counts decimals in the source figure', () => {
    expect(decimalsOf(12.5)).toBe(1);
    expect(decimalsOf(208000)).toBe(0);
    expect(decimalsOf(0.25)).toBe(2);
  });
});

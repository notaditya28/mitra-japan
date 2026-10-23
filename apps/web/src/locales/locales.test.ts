import { describe, expect, it } from 'vitest';
import en from './en.json';
import hi from './hi.json';
import gu from './gu.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe('locales', () => {
  const base = keys(en).sort();
  it.each([
    ['hi', hi],
    ['gu', gu],
  ])('%s has the same keys as en', (_, locale) => {
    expect(keys(locale).sort()).toEqual(base);
  });
});

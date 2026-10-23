import { describe, expect, it } from 'vitest';
import { explainScan } from './explain';
import { matchIngredients } from './matchIngredients';

// Minimal stand-in for i18next: echoes the key and interpolated items.
const t = (key: string, o?: Record<string, string>) => (o?.items ? `${key}:${o.items}` : key);

describe('explainScan', () => {
  it('names the conflicting ingredient', () => {
    const r = matchIngredients('ラーメン（ラード）', 'vegetarian');
    expect(explainScan(r, t)).toBe('scanner.explain.conflict:Lard (pork fat)');
  });

  it('names the ingredient it could not judge', () => {
    const r = matchIngredients('味噌汁（出汁）', 'vegan');
    expect(explainScan(r, t)).toMatch(/^scanner\.explain\.unverified:Dashi/);
  });

  it('explains unreadable input', () => {
    expect(explainScan(matchIngredients('', 'jain'), t)).toBe('scanner.explain.unreadable');
  });

  it('never says "safe" for a clear result', () => {
    expect(explainScan(matchIngredients('枝豆', 'vegan'), t)).toBe('scanner.explain.clear');
  });
});

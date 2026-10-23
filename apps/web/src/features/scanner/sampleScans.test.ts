import { describe, expect, it } from 'vitest';
import samples from '../../data/sampleScans.json';
import { matchIngredients } from './matchIngredients';

describe('sample scans', () => {
  it('has 20-30 labelled samples with unique ids', () => {
    expect(samples.status).toBe('sample');
    expect(samples.scans.length).toBeGreaterThanOrEqual(20);
    expect(samples.scans.length).toBeLessThanOrEqual(30);
    const ids = samples.scans.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only words in our dictionary, except the deliberately unreadable one', () => {
    for (const s of samples.scans) {
      const r = matchIngredients(s.menuText, 'vegetarian');
      if (s.id === 'blurred') expect(r.reason, s.id).toBe('unreadable');
      else expect(r.unknown, s.id).toEqual([]);
    }
  });

  it('shows all three results for vegetarians, including a hidden conflict', () => {
    const verdicts = samples.scans.map((s) => matchIngredients(s.menuText, 'vegetarian').verdict);
    expect(new Set(verdicts)).toEqual(new Set(['clear', 'conflict', 'unverified']));
    expect(
      samples.scans.some(
        (s) => s.looksVeg && matchIngredients(s.menuText, 'vegetarian').verdict === 'conflict',
      ),
    ).toBe(true);
  });

  it('gives different answers for different diets on the same dish', () => {
    const potato = samples.scans.find((s) => s.id === 'potato-chips')?.menuText ?? '';
    expect(matchIngredients(potato, 'vegetarian').verdict).toBe('clear');
    expect(matchIngredients(potato, 'jain').verdict).toBe('conflict');
  });
});

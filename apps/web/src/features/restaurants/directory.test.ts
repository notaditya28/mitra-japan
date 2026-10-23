import { describe, expect, it } from 'vitest';
import { RESTAURANTS } from '../planner/data';
import { DEFAULT_FILTERS, filterRestaurants } from './directory';

const run = (f: Partial<typeof DEFAULT_FILTERS>) =>
  filterRestaurants(RESTAURANTS, { ...DEFAULT_FILTERS, ...f });

describe('restaurant directory filters', () => {
  it('returns everything by default, real places before samples in each city', () => {
    const all = run({});
    expect(all).toHaveLength(RESTAURANTS.length);
    const tokyo = all.filter((r) => r.cityId === 'tokyo');
    const firstSample = tokyo.findIndex((r) => r.status === 'sample');
    expect(tokyo.slice(firstSample).every((r) => r.status === 'sample')).toBe(true);
  });

  it('filters by city, diet and kind of entry', () => {
    expect(run({ cityId: 'kyoto' }).every((r) => r.cityId === 'kyoto')).toBe(true);
    expect(run({ diet: 'jain' }).every((r) => r.dietOptions.some((o) => o.diet === 'jain'))).toBe(
      true,
    );
    expect(run({ show: 'sample' }).every((r) => r.status === 'sample')).toBe(true);
    expect(run({ show: 'listed' }).every((r) => r.status !== 'sample')).toBe(true);
  });

  it('can hide places without recorded evidence for the chosen diet', () => {
    const withEvidence = run({ diet: 'vegan', evidenceOnly: true });
    expect(withEvidence.length).toBeGreaterThan(0);
    for (const r of withEvidence) {
      const vegan = r.dietOptions.find((o) => o.diet === 'vegan');
      expect(vegan?.basis, r.id).not.toBe('unconfirmed');
    }
  });

  it('searches names, cuisines, areas and city names, including Japanese', () => {
    expect(run({ query: 'ramen kyoto' }).map((r) => r.id)).toContain('kyoto-uzu');
    expect(run({ query: '京都' }).every((r) => r.cityId === 'kyoto')).toBe(true);
    expect(run({ query: 'ＵＺＵ' }).map((r) => r.id)).toEqual(['kyoto-uzu']);
    expect(run({ query: 'zzzz-nothing' })).toEqual([]);
  });
});

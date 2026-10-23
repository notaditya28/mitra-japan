import { describe, expect, it } from 'vitest';
import {
  ANIME_SPOTS,
  CITIES,
  FOOD_SPOTS,
  HERITAGE_SPOTS,
  REGIONAL_SPOTS,
  cityById,
  distanceKm,
  heritageNear,
} from './data';

const inJapan = (p: { lat: number; lng: number }) =>
  p.lat > 24 && p.lat < 46 && p.lng > 122 && p.lng < 146;

describe('planner data rules', () => {
  it('never marks a demo food spot as certified or verified', () => {
    expect(FOOD_SPOTS.length).toBeGreaterThan(0);
    for (const s of FOOD_SPOTS) {
      expect(s.certified, s.id).toBe(false);
      expect(s.verified, s.id).toBe(false);
      expect(s.status, s.id).toBe('sample');
    }
  });

  it('marks every unverified record with a visible status', () => {
    for (const c of CITIES) expect(c.status, c.id).toBe('needs-review');
    for (const s of [...ANIME_SPOTS, ...REGIONAL_SPOTS])
      expect(s.status, s.id).toBe('needs-review');
    for (const h of HERITAGE_SPOTS) {
      expect(h.status, h.id).toBe('needs-review');
      expect(h.references.length, h.id).toBeGreaterThan(0);
      // Association wording only, never identity.
      expect(h.story, h.id).not.toMatch(
        /same as|identical|is (Saraswati|Ganesha|Lakshmi|Kubera|Mahakala)/i,
      );
    }
  });

  it('links every spot to a known city', () => {
    for (const s of [...FOOD_SPOTS, ...ANIME_SPOTS, ...REGIONAL_SPOTS]) {
      expect(cityById(s.cityId), s.id).toBeDefined();
    }
  });

  it('has unique ids and coordinates inside Japan', () => {
    const ids = CITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of [...CITIES, ...FOOD_SPOTS, ...ANIME_SPOTS, ...REGIONAL_SPOTS]) {
      expect(inJapan(p), p.id).toBe(true);
    }
  });

  it('covers the cities the brief asks for', () => {
    for (const id of [
      'tokyo',
      'kyoto',
      'osaka',
      'nara',
      'koyasan',
      'hiroshima',
      'kanazawa',
      'takayama',
      'hakone',
      'sapporo',
      'fukuoka',
      'naha',
    ]) {
      expect(cityById(id), id).toBeDefined();
    }
  });

  it('measures distances sensibly and finds Kyoto’s Indian-roots temples', () => {
    const tokyo = cityById('tokyo');
    const kyoto = cityById('kyoto');
    if (!tokyo || !kyoto) throw new Error('missing city');
    expect(distanceKm(tokyo, kyoto)).toBeGreaterThan(350);
    expect(distanceKm(tokyo, kyoto)).toBeLessThan(400);
    expect(
      heritageNear(kyoto)
        .map((h) => h.id)
        .sort(),
    ).toEqual(['bishamonten', 'daikokuten', 'kichijoten']);
  });
});

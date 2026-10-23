import { describe, expect, it } from 'vitest';
import {
  ANIME_SPOTS,
  CITIES,
  FOOD_SPOTS,
  RESTAURANTS,
  HERITAGE_SPOTS,
  REGIONAL_SPOTS,
  cityById,
  distanceKm,
  heritageNear,
} from './data';

const inJapan = (p: { lat: number; lng: number }) =>
  p.lat > 24 && p.lat < 46 && p.lng > 122 && p.lng < 146;

describe('planner data rules', () => {
  it('keeps the restaurant directory honest', () => {
    expect(RESTAURANTS.length).toBeGreaterThanOrEqual(20);
    const ids = RESTAURANTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RESTAURANTS) {
      // Nothing is verified or certified until the owner records evidence.
      expect(r.status, r.id).not.toBe('verified');
      expect(r.certification, r.id).toBeNull();
      expect(JSON.stringify(r), r.id).not.toMatch(/certified/i);
      expect(r.dietOptions.length, r.id).toBeGreaterThan(0);
      for (const o of r.dietOptions) {
        expect(o.basis, r.id).not.toBe('independently-verified');
        // A claimed basis needs recorded evidence; no evidence means unconfirmed.
        if (o.basis === 'unconfirmed') expect(o.evidence, r.id).toBeNull();
        else expect(o.evidence?.length ?? 0, r.id).toBeGreaterThan(10);
      }
      if (r.status === 'sample') {
        expect(r.address, r.id).toBeNull();
        expect(
          r.dietOptions.every((o) => o.basis === 'unconfirmed'),
          r.id,
        ).toBe(true);
      } else {
        expect(r.address, r.id).toBeTruthy();
        expect(r.source, r.id).toBeTruthy();
        expect(r.lastChecked, r.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(r.link ?? '', r.id).toMatch(/^https:\/\//);
      }
    }
    // The directory mixes illustrative and researched places.
    expect(RESTAURANTS.some((r) => r.status === 'sample')).toBe(true);
    expect(RESTAURANTS.some((r) => r.status === 'needs-review')).toBe(true);
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

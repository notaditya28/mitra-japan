import { describe, expect, it } from 'vitest';
import tourJson from '../../data/tour.json';
import photosJson from '../../data/tourPhotos.json';
import { computeStage, locate, stage } from '../../scenes/journeyState';
import { cityById } from '../planner/data';
import { foodFor, STAYS, staysFor } from './cityMap';
import {
  buildSegments,
  isPlainBoundary,
  LAYOUT,
  layout,
  mapCityFor,
  SEGMENTS,
  TOUR_CITIES,
  WEIGHTS,
} from './tour';

describe('tour data', () => {
  it('has a photo, both image sizes and a description for every listed spot', () => {
    const listed = tourJson.cities.flatMap((c) => c.spots);
    const photos = new Set(photosJson.photos.map((p) => p.id));
    for (const id of listed) {
      expect(photos.has(id), id).toBe(true);
      expect(Object.keys(tourJson.spots), id).toContain(id);
    }
    for (const spot of TOUR_CITIES.flatMap((c) => c.spots)) {
      expect(spot.src.lg).toBeTruthy();
      expect(spot.src.sm).toBeTruthy();
    }
  });

  it('keeps every spot unverified and every photo credit pending until the owner fills them in', () => {
    for (const spot of TOUR_CITIES.flatMap((c) => c.spots)) {
      expect(spot.status).toBe('needs-review');
      // A credit may only appear together with its source and licence.
      if (spot.photo.credit) {
        expect(spot.photo.source).toBeTruthy();
        expect(spot.photo.licence).toBeTruthy();
      }
    }
  });

  it('only uses known cities, with spots near their city', () => {
    for (const city of TOUR_CITIES) {
      expect(cityById(city.id)).toBeDefined();
      for (const s of city.spots) {
        expect(Math.abs(s.lat - city.lat)).toBeLessThan(0.3);
        expect(Math.abs(s.lng - city.lng)).toBeLessThan(0.3);
      }
    }
  });
});

describe('segments', () => {
  it('flies first, then each city with a Shinkansen between cities', () => {
    expect(SEGMENTS[0]?.kind).toBe('flight');
    const kinds = SEGMENTS.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'train')).toHaveLength(TOUR_CITIES.length - 1);
    // A train is always followed by the first spot of the next city.
    SEGMENTS.forEach((s, i) => {
      if (s.kind === 'train') {
        const next = SEGMENTS[i + 1];
        expect(next?.kind).toBe('spot');
        expect(next?.kind === 'spot' && next.first).toBe(true);
        expect(next?.cityId).toBe(s.cityId);
      }
    });
  });

  it('spells the city name on arrival and the spot name inside a city', () => {
    for (const s of SEGMENTS) {
      if (s.kind !== 'spot') continue;
      expect(s.kanji).toBe(s.first ? cityById(s.cityId)?.nameJa : s.spot.kanji);
    }
  });

  it('makes transitions plain only between spots of the same city', () => {
    SEGMENTS.forEach((s, i) => {
      if (i === 0) return;
      expect(isPlainBoundary(SEGMENTS, i)).toBe(s.kind === 'spot' && !s.first);
    });
  });

  it('a new city in the data adds a train and its spots', () => {
    const [tokyo, kyoto] = TOUR_CITIES;
    if (!tokyo || !kyoto) throw new Error('expected two cities');
    const three = buildSegments([tokyo, kyoto, { ...kyoto, id: 'osaka', nameJa: '大阪' }]);
    expect(three.filter((s) => s.kind === 'train')).toHaveLength(2);
    expect(layout(three).total).toBeCloseTo(
      WEIGHTS.flight +
        2 * WEIGHTS.train +
        (tokyo.spots.length + 2 * kyoto.spots.length) * WEIGHTS.spot,
    );
  });

  it('shows the city you are in on the map, and the one you left while on the train', () => {
    expect(mapCityFor(SEGMENTS, 0)).toBeNull();
    SEGMENTS.forEach((s, i) => {
      if (s.kind === 'spot') expect(mapCityFor(SEGMENTS, i)).toBe(s.cityId);
      if (s.kind === 'train') expect(mapCityFor(SEGMENTS, i)).toBe(s.from);
    });
  });
});

describe('stage', () => {
  it('locates segments by scroll position', () => {
    const { starts, total } = LAYOUT;
    expect(locate(0, starts, total)).toEqual({ index: 0, t: 0 });
    const second = starts[1] ?? 0;
    expect(locate(second + 0.5, starts, total).index).toBe(1);
    expect(locate(total + 5, starts, total).index).toBe(SEGMENTS.length - 1);
  });

  it('closes the veil before a boundary and opens the torii window after it', () => {
    const at = (w: number) => computeStage({ ...stage }, w / LAYOUT.total);
    const b = LAYOUT.starts[1] ?? 0;
    const before = at(b - 0.02);
    expect(before.scene).toBe(0);
    expect(before.cover).toBeGreaterThan(0.5);
    expect(before.incoming).toBe(1);
    expect(before.plain).toBe(false);
    const after = at(b + 0.03);
    expect(after.scene).toBe(1);
    expect(after.cover).toBe(0);
    expect(after.iris).toBeLessThan(1);
    const middle = at(b + 0.5);
    expect(middle.incoming).toBe(-1);
    expect(middle.iris).toBe(1);
  });

  it('moves between spots of a city without the petal kanji', () => {
    const i = SEGMENTS.findIndex((s) => s.kind === 'spot' && !s.first);
    const b = LAYOUT.starts[i] ?? 0;
    const s = computeStage({ ...stage }, (b - 0.05) / LAYOUT.total);
    expect(s.plain).toBe(true);
    expect(s.assemble).toBe(0);
    expect(s.cover).toBeGreaterThan(0);
  });
});

describe('city map', () => {
  it('only shows places that list the chosen diet, real places first', () => {
    const jain = foodFor('tokyo', 'jain');
    expect(jain.length).toBeGreaterThan(0);
    for (const { restaurant, option } of jain) {
      expect(restaurant.cityId).toBe('tokyo');
      expect(option?.diet).toBe('jain');
    }
    const order = jain.map((p) => p.restaurant.status);
    const firstSample = order.indexOf('sample');
    if (firstSample >= 0) expect(order.slice(firstSample)).not.toContain('needs-review');
  });

  it('shows everything with no restriction', () => {
    expect(foodFor('kyoto', 'none').every((p) => p.option === null)).toBe(true);
    expect(foodFor('kyoto', 'none').length).toBeGreaterThanOrEqual(foodFor('kyoto', 'jain').length);
  });

  it('keeps stays as clearly labelled samples near their city', () => {
    expect(STAYS.length).toBeGreaterThan(0);
    for (const s of STAYS) {
      expect(s.status).toBe('sample');
      expect(s.name).toMatch(/^Sample /);
      const city = cityById(s.cityId);
      expect(city).toBeDefined();
      expect(Math.abs(s.lat - (city?.lat ?? 0))).toBeLessThan(0.2);
      expect(Math.abs(s.lng - (city?.lng ?? 0))).toBeLessThan(0.2);
      expect(JSON.stringify(s)).not.toMatch(/¥|₹|\$|price|available/i);
    }
    for (const city of TOUR_CITIES) expect(staysFor(city.id).length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import tourJson from '../../data/tour.json';
import en from '../../locales/en.json';
import gu from '../../locales/gu.json';
import hi from '../../locales/hi.json';
import { computeStage, locate, stage, viewOf } from '../../scenes/journeyState';
import { cityById } from '../planner/data';
import { foodFor, STAYS, staysFor } from './cityMap';
import {
  buildSegments,
  LAYOUT,
  layout,
  mapCityFor,
  PLACE_SCENES,
  SEGMENTS,
  TOUR_CITIES,
  WEIGHTS,
} from './tour';

describe('tour data', () => {
  it('describes every listed spot and gives it a known 3D scene', () => {
    const listed = tourJson.cities.flatMap((c) => c.spots);
    const built = TOUR_CITIES.flatMap((c) => c.spots).map((s) => s.id);
    expect(built).toEqual(listed);
    for (const id of listed) expect(Object.keys(tourJson.spots), id).toContain(id);
    for (const s of TOUR_CITIES.flatMap((c) => c.spots)) expect(PLACE_SCENES).toContain(s.scene);
  });

  it('keeps every spot unverified until the owner checks it', () => {
    for (const spot of TOUR_CITIES.flatMap((c) => c.spots))
      expect(spot.status).toBe('needs-review');
  });

  it('only uses known cities, with spots near their city', () => {
    for (const city of TOUR_CITIES) {
      expect(cityById(city.id)).toBeDefined();
      for (const s of city.spots) {
        // Within a day trip (Fuji from Tokyo is about 1°).
        expect(Math.abs(s.lat - city.lat)).toBeLessThan(1.2);
        expect(Math.abs(s.lng - city.lng)).toBeLessThan(1.2);
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

  it('dips to dark before every boundary and rises out of it after, cutting only while dark', () => {
    const at = (w: number) => computeStage({ ...stage }, w / LAYOUT.total);
    for (let i = 1; i < SEGMENTS.length; i++) {
      const b = LAYOUT.starts[i] ?? 0;
      const before = at(b - 0.02);
      expect(before.scene).toBe(i - 1);
      expect(before.incoming).toBe(i);
      expect(before.cover).toBeGreaterThan(0.6);
      expect(at(b - 0.01).cover).toBe(1);
      const cut = at(b + 0.01);
      expect(cut.scene).toBe(i);
      expect(cut.cover).toBe(1);
      const after = at(b + 0.05);
      expect(after.cover).toBeGreaterThan(0);
      expect(after.cover).toBeLessThan(1);
      const middle = at(b + 0.5);
      expect(middle.incoming).toBe(-1);
      expect(middle.cover).toBe(0);
    }
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

describe('views', () => {
  it('shows each spot its own 3D scene, and the flight and train their own', () => {
    SEGMENTS.forEach((s) => {
      expect(viewOf(s)).toBe(s.kind === 'spot' ? s.spot.scene : s.kind);
    });
    const { starts, total } = LAYOUT;
    SEGMENTS.forEach((s, i) => {
      const mid = ((starts[i] ?? 0) + s.weight / 2) / total;
      expect(computeStage({ ...stage }, mid).view).toBe(viewOf(s));
    });
  });
});

describe('labels', () => {
  it('has a name, area and paragraph for every spot, and the city names, in every language', () => {
    for (const locale of [en, hi, gu]) {
      const tour = locale.tour as {
        cities: Record<string, string>;
        spots: Record<string, { name?: string; area?: string; about?: string }>;
        train: { about?: string };
      };
      expect(tour.train.about).toBeTruthy();
      for (const city of TOUR_CITIES) {
        expect(tour.cities[city.id], city.id).toBeTruthy();
        for (const s of city.spots) {
          const l = tour.spots[s.slug];
          expect(l?.name, s.slug).toBeTruthy();
          expect(l?.area, s.slug).toBeTruthy();
          expect(l?.about, s.slug).toBeTruthy();
        }
      }
    }
  });
});

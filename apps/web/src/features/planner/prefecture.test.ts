import { describe, expect, it } from 'vitest';
import { prefectureAt } from '../../lib/japanMap';
import { CITIES } from './data';
import { prefectureInfo, regionOf } from './prefecture';

describe('prefecture info', () => {
  it('groups prefectures by region from their JIS code', () => {
    expect(regionOf('JP-01')).toBe('hokkaido');
    expect(regionOf('JP-13')).toBe('kanto');
    expect(regionOf('JP-26')).toBe('kansai');
    expect(regionOf('JP-47')).toBe('okinawa');
    expect(regionOf('JP-99')).toBeNull();
  });

  it('describes every prefecture, including the ones with none of our cities', () => {
    const empty: string[] = [];
    for (let n = 1; n <= 47; n++) {
      const id = `JP-${String(n).padStart(2, '0')}`;
      const info = prefectureInfo(id);
      expect(info, id).not.toBeNull();
      if (!info) continue;
      expect(info.name).toBeTruthy();
      expect(info.region).not.toBeNull();
      // The centre is a real point in Japan (Okinawa stays where it is, not in the inset).
      expect(info.centre.lat).toBeGreaterThan(24);
      expect(info.centre.lat).toBeLessThan(46);
      if (info.cities.length === 0) {
        empty.push(id);
        expect(info.nearest.length).toBeGreaterThan(0);
      }
    }
    // These are exactly the prefectures that used to show nothing when clicked.
    expect(empty.length).toBeGreaterThan(0);
  });

  it('only lists our own cities and places inside the prefecture', () => {
    const kyoto = prefectureInfo('JP-26');
    expect(kyoto?.cities.map((c) => c.id)).toContain('kyoto');
    for (const c of kyoto?.cities ?? []) expect(prefectureAt(c.lng, c.lat)).toBe('JP-26');
    const ids = new Set(CITIES.map((c) => c.id));
    for (const { city, km } of kyoto?.nearest ?? []) {
      expect(ids.has(city.id)).toBe(true);
      expect(km).toBeGreaterThanOrEqual(0);
    }
  });
});

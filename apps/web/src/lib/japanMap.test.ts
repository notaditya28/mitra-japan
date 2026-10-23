import { describe, expect, it } from 'vitest';
import { buildJapanMap, prefectureAt, toMapLngLat } from './japanMap';

describe('japanMap', () => {
  const map = buildJapanMap([
    [0, 0],
    [800, 800],
  ]);

  it('has all 47 prefectures with paths', () => {
    expect(map.paths).toHaveLength(47);
    expect(map.paths.every((p) => p.d.length > 10)).toBe(true);
  });

  it('keeps Tokyo east of Kyoto and Sapporo north of both', () => {
    const tokyo = map.project(139.69, 35.69);
    const kyoto = map.project(135.77, 35.01);
    const sapporo = map.project(141.35, 43.06);
    expect(tokyo[0]).toBeGreaterThan(kyoto[0]);
    expect(sapporo[1]).toBeLessThan(tokyo[1]);
  });

  it('moves Okinawa into the inset but leaves Kyushu alone', () => {
    expect(toMapLngLat(127.68, 26.21)).toEqual([127.68 + 2.6, 26.21 + 12.2]);
    expect(toMapLngLat(130.4, 33.59)).toEqual([130.4, 33.59]);
  });

  it('fills the extent with Japan (rings wound the way d3 expects)', () => {
    const sapporo = map.project(141.35, 43.06);
    const kagoshima = map.project(130.56, 31.6);
    // Main islands span most of the box rather than collapsing to a dot.
    expect(Math.hypot(sapporo[0] - kagoshima[0], sapporo[1] - kagoshima[1])).toBeGreaterThan(500);
  });

  it('projects everything inside the requested extent', () => {
    for (const [lng, lat] of [
      [139.69, 35.69],
      [141.35, 43.06],
      [127.68, 26.21],
    ] as const) {
      const [x, y] = map.project(lng, lat);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(800);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(800);
    }
  });

  it('finds the prefecture a city sits in', () => {
    expect(prefectureAt(135.768, 35.011)).toBe('JP-26'); // Kyoto
    expect(prefectureAt(139.767, 35.681)).toBe('JP-13'); // Tokyo
    expect(prefectureAt(127.681, 26.212)).toBe('JP-47'); // Naha, Okinawa
  });

  it('exposes projected polygons for 3D extrusion', () => {
    expect(map.prefectures).toHaveLength(47);
    expect(map.prefectures[0]?.polygons[0]?.[0]?.length).toBeGreaterThan(3);
  });
});

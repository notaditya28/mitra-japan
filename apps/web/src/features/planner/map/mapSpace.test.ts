import { describe, expect, it } from 'vitest';
import { lngLatToWorld, MAP_HALF } from './mapSpace';

describe('mapSpace', () => {
  it('puts north at -z and east at +x', () => {
    const [tx, tz] = lngLatToWorld(139.767, 35.681); // Tokyo
    const [kx] = lngLatToWorld(135.768, 35.011); // Kyoto
    const [, sz] = lngLatToWorld(141.354, 43.062); // Sapporo
    expect(tx).toBeGreaterThan(kx);
    expect(sz).toBeLessThan(tz);
  });

  it('keeps every city inside the map bounds', () => {
    for (const [lng, lat] of [
      [139.767, 35.681],
      [141.354, 43.062],
      [127.681, 26.212],
      [130.402, 33.59],
    ] as const) {
      const [x, z] = lngLatToWorld(lng, lat);
      expect(Math.abs(x)).toBeLessThanOrEqual(MAP_HALF);
      expect(Math.abs(z)).toBeLessThanOrEqual(MAP_HALF);
    }
  });
});

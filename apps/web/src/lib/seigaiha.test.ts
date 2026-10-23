import { describe, expect, it } from 'vitest';
import { seigaihaDataUri, seigaihaSvg } from './seigaiha';

describe('seigaiha', () => {
  it('builds a tile 2R wide and R high', () => {
    const svg = seigaihaSvg({ line: '#000', bg: '#fff', radius: 20 });
    expect(svg).toContain('width="40" height="20"');
  });

  it('draws rows top to bottom so lower scales overlap upper ones', () => {
    const svg = seigaihaSvg({ line: '#000', bg: '#fff', radius: 20, rings: 1 });
    const ys = [...svg.matchAll(/cy="(-?[\d.]+)" r="20" fill="#fff"/g)].map((m) => Number(m[1]));
    expect(ys.length).toBeGreaterThan(4);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it('produces an encoded CSS url()', () => {
    expect(seigaihaDataUri({ line: '#4A2238', bg: '#FFF8FA' })).toMatch(
      /^url\("data:image\/svg\+xml,/,
    );
  });
});

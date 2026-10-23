/**
 * Seigaiha (青海波) wave pattern as an SVG string.
 * Tile is 2R wide and R high; rows every R/2 with alternating x offsets.
 * Circles are drawn top-to-bottom so each lower row overlaps the one above,
 * which is what produces the classic fish-scale wave look.
 */
export interface SeigaihaOptions {
  line: string;
  bg: string;
  lineOpacity?: number;
  radius?: number;
  rings?: number;
  strokeWidth?: number;
}

export function seigaihaSvg({
  line,
  bg,
  lineOpacity = 0.12,
  radius = 32,
  rings = 4,
  strokeWidth = 1.25,
}: SeigaihaOptions): string {
  const w = radius * 2;
  const h = radius;
  const step = radius / 2;
  let circles = '';
  for (let row = -2; row <= 4; row++) {
    const y = row * step;
    const xs = row % 2 === 0 ? [radius] : [0, w];
    for (const x of xs) {
      circles += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${bg}"/>`;
      for (let i = 0; i < rings; i++) {
        const r = radius * (1 - i / rings) - strokeWidth;
        circles += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="none" stroke="${line}" stroke-opacity="${lineOpacity}" stroke-width="${strokeWidth}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${circles}</svg>`;
}

export function seigaihaDataUri(opts: SeigaihaOptions): string {
  return `url("data:image/svg+xml,${encodeURIComponent(seigaihaSvg(opts))}")`;
}

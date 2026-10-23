import { useMemo } from 'react';
import heritage from '../data/heritage.json';
import { buildJapanMap } from '../lib/japanMap';
import { palette } from '../styles/tokens';

const W = 600;
const H = 640;

/**
 * Flat SVG map of Japan with the Indian-roots temples pinned in gold. Also the
 * 2D fallback for the 3D planner map on devices without WebGL.
 */
export function JapanMapSvg({ className = '', title }: { className?: string; title: string }) {
  const map = useMemo(
    () =>
      buildJapanMap([
        [16, 16],
        [W - 16, H - 16],
      ]),
    [],
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={title}>
      {map.paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill={palette.blush}
          stroke={palette.rose}
          strokeOpacity={0.5}
          strokeWidth={0.8}
        >
          <title>{p.name}</title>
        </path>
      ))}
      <rect
        x={map.inset.x}
        y={map.inset.y}
        width={map.inset.w}
        height={map.inset.h}
        fill="none"
        stroke={palette.mist}
        strokeOpacity={0.5}
        strokeDasharray="4 4"
        rx={6}
      />
      {heritage.deities.map((d) => {
        const [x, y] = map.project(d.lng, d.lat);
        return (
          <g key={d.id}>
            <circle cx={x} cy={y} r={10} fill={palette.gold} opacity={0.3} />
            <circle cx={x} cy={y} r={5} fill={palette.gold} stroke={palette.plum} strokeWidth={1.5}>
              <title>{`${d.japanese} · ${d.place}`}</title>
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

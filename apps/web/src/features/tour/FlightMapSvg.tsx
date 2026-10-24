import { useMemo } from 'react';
import {
  COUNTRIES,
  DESTINATION,
  MAP_H,
  MAP_W,
  ORIGIN,
  path,
  project,
  routeLngLat,
} from './flightMap';
import { FROM, TOUR_CITIES } from './tour';

/** Flat Delhi → first-city map for the static layout. Lazy chunk (map data + d3). */
export default function FlightMapSvg({ title }: { title: string }) {
  const shapes = useMemo(() => COUNTRIES.map((c) => ({ id: c.id, d: path(c.geometry) ?? '' })), []);
  const route = useMemo(
    () =>
      routeLngLat(80)
        .map(([lng, lat], i) => {
          const [x, y] = project(lng, lat);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(''),
    [],
  );
  const [ox, oy] = project(...ORIGIN);
  const [dx, dy] = project(...DESTINATION);
  const first = TOUR_CITIES[0];

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      role="img"
      aria-label={title}
      className="block h-auto w-full"
    >
      <rect width={MAP_W} height={MAP_H} fill="#2A1222" />
      {shapes.map((s) => (
        <path
          key={s.id}
          d={s.d}
          fill={s.id === 'IND' ? '#E9B872' : s.id === 'JPN' ? '#F4B6C6' : '#6E3A56'}
          stroke={s.id === 'IND' || s.id === 'JPN' ? '#FFF8FA' : '#8E5C74'}
          strokeWidth={s.id === 'IND' || s.id === 'JPN' ? 2.5 : 1.5}
        />
      ))}
      <path d={route} fill="none" stroke="#F0C27B" strokeWidth={6} strokeDasharray="18 12" />
      <circle cx={ox} cy={oy} r={14} fill="#F0C27B" stroke="#FFF8FA" strokeWidth={4} />
      <circle cx={dx} cy={dy} r={14} fill="#D9577F" stroke="#FFF8FA" strokeWidth={4} />
      <text x={ox} y={oy + 60} textAnchor="middle" fill="#FFF8FA" fontSize={44} fontWeight={700}>
        {FROM.name}
      </text>
      <text x={dx - 20} y={dy + 60} textAnchor="end" fill="#FFF8FA" fontSize={44} fontWeight={700}>
        {first?.name ?? ''}
      </text>
    </svg>
  );
}

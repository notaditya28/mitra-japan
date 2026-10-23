import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { palette } from '../../../styles/tokens';
import { cityById } from '../data';
import type { RouteStop } from '../route';
import { LAND_HEIGHT, lngLatToWorld } from './mapSpace';

const LIFT = LAND_HEIGHT + 0.25;
const TUBULAR = 400;
const RADIAL = 6;
const DRAW_SECONDS = 2.6;

/** Arc between stops: raised in the middle in proportion to distance, like a flight path. */
function buildCurve(stops: RouteStop[]): THREE.CurvePath<THREE.Vector3> | null {
  const pts = stops
    .map((s) => cityById(s.cityId))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c, i, all) => i === 0 || all[i - 1]?.id !== c.id)
    .map((c) => {
      const [x, z] = lngLatToWorld(c.lng, c.lat);
      return new THREE.Vector3(x, LIFT, z);
    });
  if (pts.length < 2) return null;
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!a || !b) continue;
    const mid = a.clone().lerp(b, 0.5);
    mid.y += 0.35 + a.distanceTo(b) * 0.18;
    path.add(new THREE.QuadraticBezierCurve3(a, mid, b));
  }
  return path;
}

interface RouteLineProps {
  stops: RouteStop[];
  /** Label shown on the day badges' tooltip, e.g. "Sample route". */
  label: string;
  dayLabel: (n: number) => string;
  selectedDay?: number | null;
  onSelectDay?: (day: number) => void;
}

/** Cities in route order, with all their day numbers (Kyoto on days 2 and 3 → [2, 3]). */
function badgesFor(stops: RouteStop[]): { cityId: string; days: number[] }[] {
  const out: { cityId: string; days: number[] }[] = [];
  for (const s of stops) {
    const hit = out.find((b) => b.cityId === s.cityId);
    if (hit) hit.days.push(s.day);
    else out.push({ cityId: s.cityId, days: [s.day] });
  }
  return out;
}

/**
 * Glowing gold route that draws itself city to city, a small Shinkansen that
 * then glides along it, and numbered day markers at each stop.
 */
export function RouteLine({
  stops,
  label,
  dayLabel,
  selectedDay = null,
  onSelectDay,
}: RouteLineProps) {
  const key = stops.map((s) => s.cityId).join('>');
  const curve = useMemo(() => buildCurve(stops), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // When the route only grows (days streaming in), draw just the new part.
  const prevKey = useRef('');
  const start = useMemo(() => {
    const prev = prevKey.current;
    prevKey.current = key;
    if (!prev || !key.startsWith(prev)) return 0;
    const before = prev.split('>').filter((c, i, a) => i === 0 || a[i - 1] !== c).length;
    const after = key.split('>').filter((c, i, a) => i === 0 || a[i - 1] !== c).length;
    return after > 1 ? Math.max(0, (before - 1) / (after - 1)) : 0;
  }, [key]);
  const core = useMemo(
    () => (curve ? new THREE.TubeGeometry(curve, TUBULAR, 0.035, RADIAL, false) : null),
    [curve],
  );
  const glow = useMemo(
    () => (curve ? new THREE.TubeGeometry(curve, TUBULAR, 0.1, RADIAL, false) : null),
    [curve],
  );
  const train = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    born.current = null;
    return () => {
      core?.dispose();
      glow?.dispose();
    };
  }, [core, glow]);

  useFrame(({ clock }) => {
    if (!curve || !core || !glow) return;
    if (born.current === null) born.current = clock.elapsedTime;
    const age = clock.elapsedTime - born.current;
    const duration = Math.max(0.8, DRAW_SECONDS * (1 - start));
    const drawn = Math.min(1, age / duration);
    const eased = start + (1 - start) * (1 - Math.pow(1 - drawn, 3));
    const indexCount = (core.index?.count ?? 0) * eased;
    // Index count must stay a multiple of a full ring of triangles.
    const step = RADIAL * 6;
    const n = Math.floor(indexCount / step) * step;
    core.setDrawRange(0, n);
    glow.setDrawRange(0, n);

    if (train.current) {
      const u = drawn < 1 ? eased : (eased + (age - duration) * 0.06) % 1;
      curve.getPointAt(Math.max(0.0001, Math.min(0.9999, u)), tmp);
      curve.getPointAt(Math.min(0.9999, u + 0.01), ahead);
      train.current.position.copy(tmp);
      train.current.lookAt(ahead);
    }
  });

  return (
    <group>
      {curve && core && glow ? (
        <>
          <mesh geometry={glow} renderOrder={2}>
            <meshBasicMaterial
              color={palette.gold}
              transparent
              opacity={0.25}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={core} renderOrder={3}>
            <meshBasicMaterial color={palette.gold} toneMapped={false} />
          </mesh>
          {/* Tiny Shinkansen: white body, rose stripe, pointed nose along +z */}
          <group ref={train}>
            {/* lookAt() aims +z along the route, so lay the capsule along z. */}
            <group rotation-x={Math.PI / 2}>
              <mesh>
                <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
                <meshStandardMaterial color="#FFF8FA" />
              </mesh>
              <mesh>
                <cylinderGeometry args={[0.063, 0.063, 0.18, 8, 1, true]} />
                <meshBasicMaterial color={palette.rose} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
        </>
      ) : null}
      {badgesFor(stops).map((b) => {
        const c = cityById(b.cityId);
        if (!c) return null;
        const [x, z] = lngLatToWorld(c.lng, c.lat);
        const on = selectedDay !== null && b.days.includes(selectedDay);
        const first = b.days[0] ?? 1;
        return (
          <Html
            key={b.cityId}
            // East of each lantern, so badges never cover the city label.
            position={[x + 0.32, LIFT - 0.05, z + 0.12]}
            center
            zIndexRange={[25, 0]}
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDay?.(
                  on && b.days.length > 1
                    ? (b.days[b.days.indexOf(selectedDay ?? first) + 1] ?? first)
                    : first,
                );
              }}
              aria-pressed={on}
              aria-label={`${label}: ${b.days.map(dayLabel).join(', ')} · ${c.name}`}
              className={`flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-paper px-1.5 text-xs font-bold shadow-lift transition ${
                on ? 'scale-125 bg-rose text-white' : 'bg-gold text-plum'
              }`}
            >
              {b.days.join('·')}
            </button>
          </Html>
        );
      })}
    </group>
  );
}

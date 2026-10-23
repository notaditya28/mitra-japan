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
}

/**
 * Glowing gold route that draws itself city to city, a small Shinkansen that
 * then glides along it, and numbered day markers at each stop.
 */
export function RouteLine({ stops, label, dayLabel }: RouteLineProps) {
  const curve = useMemo(() => buildCurve(stops), [stops]);
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
    const drawn = Math.min(1, age / DRAW_SECONDS);
    const eased = 1 - Math.pow(1 - drawn, 3);
    const indexCount = (core.index?.count ?? 0) * eased;
    // Index count must stay a multiple of a full ring of triangles.
    const step = RADIAL * 6;
    const n = Math.floor(indexCount / step) * step;
    core.setDrawRange(0, n);
    glow.setDrawRange(0, n);

    if (train.current) {
      const u = drawn < 1 ? eased : ((age - DRAW_SECONDS) * 0.06) % 1;
      curve.getPointAt(Math.max(0.0001, Math.min(0.9999, u)), tmp);
      curve.getPointAt(Math.min(0.9999, u + 0.01), ahead);
      train.current.position.copy(tmp);
      train.current.lookAt(ahead);
    }
  });

  if (!curve || !core || !glow) return null;
  return (
    <group>
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
      {stops.map((s) => {
        const c = cityById(s.cityId);
        if (!c) return null;
        const [x, z] = lngLatToWorld(c.lng, c.lat);
        return (
          <Html
            key={`${s.cityId}-${s.day}`}
            // East of each lantern, so badges never cover the city label.
            position={[x + 0.32, LIFT - 0.05, z + 0.12]}
            center
            zIndexRange={[25, 0]}
          >
            <span
              title={`${label}: ${dayLabel(s.day)} · ${c.name}`}
              className="grid h-6 w-6 place-items-center rounded-full border-2 border-paper bg-gold text-xs font-bold text-plum shadow-lift"
            >
              {s.day}
            </span>
          </Html>
        );
      })}
    </group>
  );
}

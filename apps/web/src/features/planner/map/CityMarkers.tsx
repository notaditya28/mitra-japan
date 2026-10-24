import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { palette } from '../../../styles/tokens';
import { prefectureAt } from '../../../lib/japanMap';
import { CITIES } from '../data';
import { mapHover } from './mapHover';
import { LAND_HEIGHT, lngLatToWorld } from './mapSpace';

const TOP = LAND_HEIGHT + 0.06;

/** Which prefecture each city sits in, so hovering a prefecture reveals its city names. */
const CITY_PREFECTURE: Record<string, string | null> = Object.fromEntries(
  CITIES.map((c) => [c.id, prefectureAt(c.lng, c.lat) ?? null]),
);
/** Labels nudged off neighbours (Osaka sits right under Kyoto). */
const NUDGE: Record<string, [number, number, number]> = {
  osaka: [-0.7, 0.45, 0.45],
  kanazawa: [-0.35, 0.8, -0.25],
  nara: [0.6, 0.5, 0.35],
};

interface CityMarkersProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * A small lantern post per city plus a clickable HTML label. Labels stay hidden until the
 * pointer is over the city's prefecture (or the label itself, or it has keyboard focus).
 */
export function CityMarkers({ selectedId, onSelect }: CityMarkersProps) {
  const heads = useRef<Record<string, THREE.Mesh | null>>({});
  const labels = useRef<Record<string, HTMLButtonElement | null>>({});

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-dt * 8);
    const hovered = mapHover.prefecture;
    for (const c of CITIES) {
      const label = labels.current[c.id];
      if (label) {
        const show =
          (hovered !== null && CITY_PREFECTURE[c.id] === hovered) || mapHover.label === c.id;
        if (label.dataset.show !== String(show)) label.dataset.show = String(show);
      }
      const m = heads.current[c.id];
      if (!m) continue;
      const on = c.id === selectedId;
      const target = on ? 1.6 + Math.sin(clock.elapsedTime * 3) * 0.08 : 1;
      m.scale.setScalar(m.scale.x + (target - m.scale.x) * k);
    }
  });

  return (
    <group>
      {CITIES.map((c) => {
        const [x, z] = lngLatToWorld(c.lng, c.lat);
        const on = c.id === selectedId;
        return (
          <group key={c.id} position={[x, TOP, z]}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.025, 0.035, 0.36, 6]} />
              <meshStandardMaterial color={palette.plum} />
            </mesh>
            <mesh
              ref={(el) => {
                heads.current[c.id] = el;
              }}
              position={[0, 0.42, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(c.id);
              }}
            >
              <sphereGeometry args={[0.09, 12, 10]} />
              <meshStandardMaterial
                color={on ? palette.sakura : palette.paper}
                emissive={on ? palette.sakura : palette.gold}
                emissiveIntensity={on ? 0.6 : 0.25}
              />
            </mesh>
            <Html position={NUDGE[c.id] ?? [0, 0.72, 0]} center zIndexRange={[20, 0]}>
              <button
                ref={(el) => {
                  labels.current[c.id] = el;
                }}
                type="button"
                // Labels sit in the canvas wrapper; keep their clicks away from R3F's
                // raycaster, which would otherwise read them as "clicked empty map".
                onPointerDown={(e) => e.stopPropagation()}
                // Moving from the prefecture onto its label must not hide the label.
                onPointerEnter={() => (mapHover.label = c.id)}
                onPointerLeave={() => {
                  if (mapHover.label === c.id) mapHover.label = null;
                }}
                onFocus={() => (mapHover.label = c.id)}
                onBlur={() => {
                  if (mapHover.label === c.id) mapHover.label = null;
                }}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(c.id);
                }}
                aria-pressed={on}
                data-show="false"
                className={`pointer-events-none whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold opacity-0 shadow-soft transition duration-300 data-[show=true]:pointer-events-auto data-[show=true]:opacity-100 ${
                  on
                    ? 'border-rose bg-rose text-white'
                    : 'border-white/60 bg-paper/90 text-plum hover:border-rose'
                }`}
              >
                <span lang="ja" className="mr-1 font-display">
                  {c.nameJa}
                </span>
                {c.name}
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

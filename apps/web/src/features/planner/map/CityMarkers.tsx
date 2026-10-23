import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { palette } from '../../../styles/tokens';
import { CITIES } from '../data';
import { LAND_HEIGHT, lngLatToWorld } from './mapSpace';

const TOP = LAND_HEIGHT + 0.06;

/** Labelled in the overview; the rest appear when you zoom in or select them. */
const MAJOR = new Set([
  'tokyo',
  'kyoto',
  'osaka',
  'sapporo',
  'fukuoka',
  'hiroshima',
  'naha',
  'kanazawa',
]);
/** Labels nudged off neighbours (Osaka sits right under Kyoto). */
const NUDGE: Record<string, [number, number, number]> = {
  osaka: [-0.7, 0.45, 0.45],
  kanazawa: [-0.35, 0.8, -0.25],
  nara: [0.6, 0.5, 0.35],
};
const LABEL_ZOOM_Y = 13;

interface CityMarkersProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** A small lantern post per city plus a clickable HTML label. */
export function CityMarkers({ selectedId, onSelect }: CityMarkersProps) {
  const heads = useRef<Record<string, THREE.Mesh | null>>({});
  const labels = useRef<Record<string, HTMLButtonElement | null>>({});

  useFrame(({ clock, camera }, dt) => {
    const k = 1 - Math.exp(-dt * 8);
    const close = camera.position.y < LABEL_ZOOM_Y;
    for (const c of CITIES) {
      const label = labels.current[c.id];
      if (label) {
        const show = close || MAJOR.has(c.id) || c.id === selectedId;
        label.style.opacity = show ? '1' : '0';
        label.style.pointerEvents = show ? 'auto' : 'none';
        label.tabIndex = show ? 0 : -1;
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
                onClick={() => onSelect(c.id)}
                aria-pressed={on}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-soft transition duration-300 ${
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

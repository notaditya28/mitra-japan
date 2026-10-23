import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { gateGeometry } from '../../../scenes/journey/Gates';
import type { MapLayer } from '../../../store/useAppStore';
import { LAYER_COLORS } from './layerColors';
import { LAND_HEIGHT, lngLatToWorld } from './mapSpace';

export interface Pin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string;
}

const TOP = LAND_HEIGHT + 0.05;

function PinShape({ layer }: { layer: MapLayer }) {
  const gate = gateGeometry();
  const color = LAYER_COLORS[layer];
  switch (layer) {
    case 'vegSafe':
      return (
        <group>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.4, 4]} />
            <meshStandardMaterial color="#4A6B50" />
          </mesh>
          <mesh position={[0, 0.44, 0]} scale={[1, 0.65, 1]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
          </mesh>
        </group>
      );
    case 'heritage':
      return (
        <mesh position={[0, 0.5, 0]}>
          <octahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.5}
            flatShading
          />
        </mesh>
      );
    case 'anime':
      return (
        <mesh position={[0, 0.34, 0]} rotation-x={Math.PI}>
          <coneGeometry args={[0.1, 0.32, 6]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            flatShading
          />
        </mesh>
      );
    case 'regional':
      return (
        <group scale={0.09}>
          <mesh geometry={gate.red}>
            <meshStandardMaterial color={color} flatShading />
          </mesh>
          <mesh geometry={gate.dark}>
            <meshStandardMaterial color="#2A1820" flatShading />
          </mesh>
        </group>
      );
  }
}

interface LayerPinsProps {
  layer: MapLayer;
  pins: Pin[];
  visible: boolean;
}

/**
 * One layer of map pins. Toggling springs each pin up or down with a small
 * stagger; hovering shows its name.
 */
export function LayerPins({ layer, pins, visible }: LayerPinsProps) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const shown = useRef(pins.map(() => 0));
  const [hover, setHover] = useState<number | null>(null);
  const positions = useMemo(
    () =>
      pins.map((p) => {
        const [x, z] = lngLatToWorld(p.lng, p.lat);
        return new THREE.Vector3(x, TOP, z);
      }),
    [pins],
  );
  const start = useRef(0);
  const wasVisible = useRef(visible);

  useFrame(({ clock, camera }, dt) => {
    // Pins grow when zoomed out so they stay readable in the overview.
    const zoom = THREE.MathUtils.clamp(camera.position.y / 9, 1, 2.3);
    if (wasVisible.current !== visible) {
      wasVisible.current = visible;
      start.current = clock.elapsedTime;
    }
    const since = clock.elapsedTime - start.current;
    pins.forEach((_, i) => {
      const g = groups.current[i];
      if (!g) return;
      const target = visible && since > i * 0.035 ? 1 : 0;
      const cur = shown.current[i] ?? 0;
      // Slightly underdamped so pins pop.
      const next = cur + (target - cur) * (1 - Math.exp(-dt * 9));
      shown.current[i] = next;
      const s = next < 0.001 ? 0.0001 : next * (1 + Math.sin(next * Math.PI) * 0.25) * zoom;
      g.scale.setScalar(s);
      g.visible = next > 0.01;
      if (layer === 'heritage') g.rotation.y = clock.elapsedTime * 0.8 + i;
    });
  });

  return (
    <group>
      {pins.map((p, i) => (
        <group
          key={p.id}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={positions[i]}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(i);
          }}
          onPointerOut={() => setHover((h) => (h === i ? null : h))}
        >
          <PinShape layer={layer} />
          {hover === i && visible ? (
            <Html position={[0, 0.85, 0]} center zIndexRange={[30, 0]}>
              <div className="pointer-events-none w-max max-w-[220px] rounded-xl bg-plum/95 px-3 py-2 text-left text-xs text-paper shadow-lift">
                <p className="font-semibold">{p.label}</p>
                {p.sub ? <p className="mt-0.5 text-blush/80">{p.sub}</p> : null}
              </div>
            </Html>
          ) : null}
        </group>
      ))}
    </group>
  );
}

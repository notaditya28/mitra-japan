import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { palette } from '../../../styles/tokens';
import { usePlannerStore } from '../usePlannerStore';
import { LAND_HEIGHT, lngLatToWorld } from './mapSpace';

/** A pulsing ring and name tag on the stop the traveller clicked in a day card. */
export function StopMarker() {
  const stop = usePlannerStore((s) => s.focusedStop);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const r = ring.current;
    if (!r) return;
    const k = (clock.elapsedTime * 0.8) % 1;
    r.scale.setScalar(0.6 + k * 1.4);
    (r.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
  });

  if (!stop) return null;
  const [x, z] = lngLatToWorld(stop.lng, stop.lat);
  return (
    <group position={[x, LAND_HEIGHT + 0.08, z]}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.09, 20]} />
        <meshBasicMaterial color={palette.rose} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.16, 0.22, 32]} />
        <meshBasicMaterial color={palette.rose} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <Html position={[0, 0.55, 0]} center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
        <span className="whitespace-nowrap rounded-full bg-rose px-2.5 py-1 text-[11px] font-semibold text-white shadow-soft">
          {stop.name}
        </span>
      </Html>
    </group>
  );
}

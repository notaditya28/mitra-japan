import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PETAL_POINTS } from './petalShape';

interface Petals3DProps {
  count: number;
  /** Half-extents of the box petals fall through. Defaults to the visible viewport. */
  area?: [number, number, number];
  center?: [number, number, number];
  color?: string;
}

function petalGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (const [a, b, c, d, x, y] of PETAL_POINTS) shape.bezierCurveTo(a, b, c, d, x, y);
  const geo = new THREE.ShapeGeometry(shape, 6);
  geo.translate(0, -0.5, 0);
  geo.scale(0.12, 0.12, 0.12);
  return geo;
}

/**
 * Instanced falling petals: one draw call regardless of count.
 * Matte, double-sided, gently tumbling. Parent Canvas controls pausing.
 */
export function Petals3D({ count, area, center = [0, 0, 0], color = '#F7C6D0' }: Petals3DProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(petalGeometry, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const viewport = useThree((s) => s.viewport);
  const [ax, ay, az] = area ?? [viewport.width / 2 + 0.5, viewport.height / 2 + 0.5, 3];
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        // Normalised -1..1 so the field adapts when the viewport resizes.
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
        z: Math.random() * 2 - 1,
        fall: 0.25 + Math.random() * 0.35,
        sway: 0.2 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        spin: 0.4 + Math.random() * 0.8,
        scale: 0.7 + Math.random() * 0.6,
      })),
    [count],
  );

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(delta, 0.05);
    seeds.forEach((s, i) => {
      s.phase += dt * s.spin;
      s.y -= (dt * s.fall) / ay;
      s.x += (Math.sin(s.phase) * s.sway * dt + dt * 0.12) / ax;
      if (s.y < -1) {
        s.y = 1;
        s.x = Math.random() * 2 - 1;
      }
      if (s.x > 1) s.x = -1;
      dummy.position.set(center[0] + s.x * ax, center[1] + s.y * ay, center[2] + s.z * az);
      dummy.rotation.set(s.phase * 0.9, s.phase * 1.3, s.phase * 0.5);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

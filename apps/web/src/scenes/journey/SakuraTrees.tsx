import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { rng } from './common';

const CANOPY = ['#F7C6D0', '#FBE3EA', '#F2A9BC', '#EE9DB3'];

interface SakuraTreesProps {
  count: number;
  seed?: number;
  /** Distance from the centre line, both sides. */
  x: [number, number];
  /** z range trees are scattered over (from, to). */
  z: [number, number];
  size?: [number, number];
  colors?: string[];
}

/** Low-poly cherry trees on both sides of a path: two instanced draw calls. */
export function SakuraTrees({
  count,
  seed = 7,
  x,
  z,
  size = [0.55, 1],
  colors = CANOPY,
}: SakuraTreesProps) {
  const canopy = useRef<THREE.InstancedMesh>(null);
  const trunk = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: (i % 2 === 0 ? -1 : 1) * (x[0] + r() * (x[1] - x[0])),
      z: z[0] + r() * (z[1] - z[0]),
      s: size[0] + r() * (size[1] - size[0]),
      rot: r() * Math.PI,
      color: colors[Math.floor(r() * colors.length)] ?? '#F7C6D0',
    }));
  }, [count, seed, x, z, size, colors]);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    trees.forEach((t, i) => {
      d.position.set(t.x, 2.2 * t.s, t.z);
      d.rotation.set(0, t.rot, 0);
      d.scale.set(1.3 * t.s, t.s, 1.3 * t.s);
      d.updateMatrix();
      canopy.current?.setMatrixAt(i, d.matrix);
      canopy.current?.setColorAt(i, c.set(t.color));
      d.position.set(t.x, 0.8 * t.s, t.z);
      d.scale.setScalar(t.s);
      d.updateMatrix();
      trunk.current?.setMatrixAt(i, d.matrix);
    });
    if (canopy.current) {
      canopy.current.instanceMatrix.needsUpdate = true;
      if (canopy.current.instanceColor) canopy.current.instanceColor.needsUpdate = true;
    }
    if (trunk.current) trunk.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  return (
    <>
      <instancedMesh ref={canopy} args={[undefined, undefined, count]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={trunk} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.1, 0.16, 1.6, 5]} />
        <meshStandardMaterial color="#4A2A35" flatShading roughness={1} />
      </instancedMesh>
    </>
  );
}

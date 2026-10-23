import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TUNNEL_END_Z } from '../journeyState';

/** Seeded PRNG so the landscape is identical on every load. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const CANOPY = ['#F7C6D0', '#FBE3EA', '#F2A9BC', '#EE9DB3'];

function SakuraTrees({ count }: { count: number }) {
  const canopy = useRef<THREE.InstancedMesh>(null);
  const trunk = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: count }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return {
        x: side * (3.6 + r() * 8),
        z: 6 - r() * (6 - TUNNEL_END_Z + 12),
        s: 0.55 + r() * 0.45,
        rot: r() * Math.PI,
        color: CANOPY[Math.floor(r() * CANOPY.length)] ?? CANOPY[0],
      };
    });
  }, [count]);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    trees.forEach((t, i) => {
      d.position.set(t.x, 2.2 * t.s, t.z);
      d.rotation.set(0, t.rot, 0);
      d.scale.set(1.3 * t.s, 1 * t.s, 1.3 * t.s);
      d.updateMatrix();
      canopy.current?.setMatrixAt(i, d.matrix);
      canopy.current?.setColorAt(i, c.set(t.color ?? '#F7C6D0'));
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

function Hills() {
  const hills = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 14 }, (_, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return {
        pos: [side * (48 + r() * 70), 0, -60 - r() * 60] as [number, number, number],
        scale: [18 + r() * 22, 6 + r() * 10, 14 + r() * 16] as [number, number, number],
        color: r() > 0.5 ? '#5A2C45' : '#6B3550',
      };
    });
  }, []);
  return (
    <>
      {hills.map((h, i) => (
        <mesh key={i} position={h.pos} scale={h.scale}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={h.color} flatShading roughness={1} />
        </mesh>
      ))}
    </>
  );
}

export function Landscape({ trees }: { trees: number }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -100]}>
        <planeGeometry args={[800, 600]} />
        <meshStandardMaterial color="#7A4160" roughness={1} />
      </mesh>
      {/* Stone path running through the gates */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, (16 + TUNNEL_END_Z - 20) / 2]}>
        <planeGeometry args={[2.3, 16 - TUNNEL_END_Z + 20]} />
        <meshStandardMaterial color="#C69AA8" roughness={1} />
      </mesh>
      <Hills />
      <SakuraTrees count={trees} />
    </group>
  );
}

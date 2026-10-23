import { useMemo } from 'react';
import * as THREE from 'three';
import { journey } from '../journeyState';
import { rng, smooth, useSceneGroup, type CameraPath } from '../journey/common';
import { GateRow, GlowGate } from '../journey/Gates';
import { SakuraTrees } from '../journey/SakuraTrees';
import { Fuji, Sun } from '../journey/SunAndFuji';

const PORTAL_Z = -3.6;

function Hills() {
  const hills = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 14 }, (_, i) => ({
      pos: [(i % 2 === 0 ? -1 : 1) * (48 + r() * 70), 0, -60 - r() * 60] as [
        number,
        number,
        number,
      ],
      scale: [18 + r() * 22, 6 + r() * 10, 14 + r() * 16] as [number, number, number],
      color: r() > 0.5 ? '#5A2C45' : '#6B3550',
    }));
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

/** Scene 0: dawn over Fuji, a sakura avenue and a short torii row ending in the first portal. */
export function FujiScene({ trees }: { trees: number }) {
  const group = useSceneGroup(0);
  return (
    <group ref={group}>
      <Sun
        position={[0, 22, -230]}
        rise={() => (1 - Math.pow(1 - journey.intro, 3)) * 36 + journey.persona * 3}
      />
      <Fuji position={[0, 0, -150]} scale={1.3} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -100]}>
        <planeGeometry args={[800, 600]} />
        <meshStandardMaterial color="#7A4160" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -10]}>
        <planeGeometry args={[2.3, 60]} />
        <meshStandardMaterial color="#C69AA8" roughness={1} />
      </mesh>
      <Hills />
      <SakuraTrees count={trees} x={[3.6, 11.6]} z={[6, -40]} />
      <GateRow zs={[4, 2.1, 0.2, -1.7]} />
      <GlowGate position={[0, 0, PORTAL_Z]} portal />
    </group>
  );
}

const HERO_POS = new THREE.Vector3(0, 2.6, 19);
const HERO_LOOK = new THREE.Vector3(0, 17, -42);
const MOUTH_POS = new THREE.Vector3(0, 1.85, 9);
const MOUTH_LOOK = new THREE.Vector3(0, 4.5, -40);

/** Hero drift, glide to the gate row during persona, then dive through the portal. */
export const fujiCamera: CameraPath = (t, pos, look) => {
  pos.copy(HERO_POS).setZ(HERO_POS.z - journey.hero * 2.5);
  look.copy(HERO_LOOK);
  const glide = smooth(0, 0.7, t);
  pos.lerp(MOUTH_POS, glide);
  look.lerp(MOUTH_LOOK, glide);
  const dive = smooth(0.7, 1, t);
  pos.z = THREE.MathUtils.lerp(pos.z, PORTAL_Z - 0.6, dive);
  look.y = THREE.MathUtils.lerp(look.y, 1.9, dive);
};

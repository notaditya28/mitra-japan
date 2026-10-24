import { useMemo } from 'react';
import * as THREE from 'three';
import { palette } from '../../styles/tokens';
import { rng, smooth, useSceneGroup, type CameraPath } from '../journey/common';
import { GateRow, GlowGate } from '../journey/Gates';
import { SakuraTrees } from '../journey/SakuraTrees';
import { Sun } from '../journey/SunAndFuji';

const VIEW = 'kyoto';
const START_Z = 13.5;
const END_Z = -50;
// Camera reaches this gate at t ≈ 0.45, exactly when the visa card flips.
const FEAR_GATE_Z = -15;
const TUNNEL_END_Z = -24;

const ROOF = '#3A2430';
const WALL = '#F3E2D8';

/** Five-storey pagoda: shrinking bodies under wide, low roofs, topped by a gold spire. */
function Pagoda({ position }: { position: [number, number, number] }) {
  const tiers = Array.from({ length: 5 }, (_, i) => {
    const s = 1 - i * 0.13;
    return { y: 1.2 + i * 2.25, body: 3.2 * s, roof: 6 * s };
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[4.6, 1, 4.6]} />
        <meshStandardMaterial color="#B9A3AA" roughness={1} />
      </mesh>
      {tiers.map((t, i) => (
        <group key={i} position={[0, t.y, 0]}>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[t.body, 1.4, t.body]} />
            <meshStandardMaterial color={palette.torii} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 1.65, 0]} rotation-y={Math.PI / 4}>
            <coneGeometry args={[t.roof * 0.72, 0.9, 4, 1]} />
            <meshStandardMaterial color={ROOF} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 13.6, 0]}>
        <cylinderGeometry args={[0.08, 0.14, 3.4, 6]} />
        <meshStandardMaterial
          color={palette.gold}
          emissive={palette.gold}
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

function TempleHall({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[11, 0.8, 7]} />
        <meshStandardMaterial color="#B9A3AA" roughness={1} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[9, 2.8, 5.4]} />
        <meshStandardMaterial color={WALL} roughness={1} />
      </mesh>
      {[-3.6, -1.2, 1.2, 3.6].map((x) => (
        <mesh key={x} position={[x, 2.2, 2.75]}>
          <boxGeometry args={[0.3, 2.8, 0.12]} />
          <meshStandardMaterial color={palette.torii} />
        </mesh>
      ))}
      <mesh position={[0, 4.6, 0]} rotation-y={Math.PI / 4} scale={[1.45, 1, 1]}>
        <coneGeometry args={[7.4, 2.6, 4, 1]} />
        <meshStandardMaterial color={ROOF} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

/** Stone tōrō lanterns lining the courtyard path, glowing warm at dusk. */
function StoneLanterns() {
  const zs = [-28, -33, -38, -43];
  return (
    <>
      {zs.flatMap((z) =>
        [-1.9, 1.9].map((x) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.14, 0.2, 1, 6]} />
              <meshStandardMaterial color="#A8949C" roughness={1} flatShading />
            </mesh>
            <mesh position={[0, 1.2, 0]}>
              <boxGeometry args={[0.5, 0.45, 0.5]} />
              <meshStandardMaterial
                color="#FBE3C4"
                emissive={palette.gold}
                emissiveIntensity={1.1}
              />
            </mesh>
            <mesh position={[0, 1.6, 0]} rotation-y={Math.PI / 4}>
              <coneGeometry args={[0.55, 0.4, 4]} />
              <meshStandardMaterial color="#8E7A82" roughness={1} flatShading />
            </mesh>
          </group>
        )),
      )}
    </>
  );
}

function Mountains() {
  const hills = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 10 }, (_, i) => ({
      pos: [-90 + i * 20 + r() * 8, 0, -110 - r() * 30] as [number, number, number],
      scale: [16 + r() * 10, 14 + r() * 14, 12] as [number, number, number],
      color: i % 2 ? '#6B3550' : '#7A4160',
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

/** Kyoto: Fushimi Inari torii tunnel opening onto a temple at sunset. Answers "Is the visa hard?". */
export function KyotoScene({ trees }: { trees: number }) {
  const group = useSceneGroup(VIEW);
  const tunnel = useMemo(() => {
    const out: number[] = [];
    for (let z = 8; z > TUNNEL_END_Z; z -= 1.9) if (Math.abs(z - FEAR_GATE_Z) > 1.2) out.push(z);
    return out;
  }, []);

  return (
    <group ref={group}>
      <Sun position={[-30, 18, -220]} radius={13} color="#F6B48A" />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -80]}>
        <planeGeometry args={[500, 400]} />
        <meshStandardMaterial color="#8A5068" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -18]}>
        <planeGeometry args={[2.4, 70]} />
        <meshStandardMaterial color="#D2B3BC" roughness={1} />
      </mesh>
      {/* Gravel courtyard */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, -40]}>
        <planeGeometry args={[30, 24]} />
        <meshStandardMaterial color="#C9AEB6" roughness={1} />
      </mesh>
      <Mountains />
      <GateRow zs={tunnel} />
      <GlowGate position={[0, 0, FEAR_GATE_Z]} />
      <Pagoda position={[8, 0, -42]} />
      <TempleHall position={[-9, 0, -46]} />
      <StoneLanterns />
      <SakuraTrees count={Math.round(trees * 0.7)} seed={33} x={[4, 14]} z={[10, -56]} />
      <pointLight
        position={[0, 3, -36]}
        color={palette.gold}
        intensity={10}
        distance={18}
        decay={1.4}
      />
      <GlowGate position={[0, 0, 11]} scale={1.15} lanterns={false} portal />
      <GlowGate position={[0, 0, END_Z + 2]} scale={1.4} portal />
    </group>
  );
}

/** Dolly through the tunnel, step into the courtyard and glance up at the pagoda, then on to the portal. */
export const kyotoCamera: CameraPath = (t, pos, look) => {
  const z = THREE.MathUtils.lerp(START_Z, END_Z, t);
  const out = smooth(0.55, 0.7, t);
  pos.set(0, 1.85 + out * 0.4, z);
  const glance = out * (1 - smooth(0.82, 0.92, t));
  look.set(glance * 6, 1.95 + glance * 4, z - 12 + glance * 4);
};

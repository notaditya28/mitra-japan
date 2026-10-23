import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { palette } from '../../styles/tokens';
import { localT, smooth, useSceneGroup, type CameraPath } from '../journey/common';
import { GlowGate } from '../journey/Gates';
import { SakuraTrees } from '../journey/SakuraTrees';
import { Fuji, Sun } from '../journey/SunAndFuji';

const INDEX = 2;
const VIADUCT_Z = -26;
const DECK_Y = 5;
const CARS = 8;
const CAR_LEN = 5.4;
const START_Z = 14;
const END_Z = -48;

const BODY = '#F6F0F2';
const STRIPE = palette.rose;
const GLASS = '#2A1820';

/** Side profile of the long "duck-bill" nose, extruded across the train's width. */
function noseGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(5.4, 0);
  s.lineTo(5.4, 1.55);
  s.lineTo(3.4, 1.55);
  s.bezierCurveTo(1.8, 1.5, 0.6, 0.75, 0, 0.32);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 1.2,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.14,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.translate(-5.4, 0, -0.6);
  return geo;
}

function Train() {
  const group = useRef<THREE.Group>(null);
  const nose = useMemo(noseGeometry, []);
  const car = useMemo(() => new RoundedBoxGeometry(CAR_LEN - 0.15, 1.55, 1.48, 3, 0.22), []);

  useFrame(() => {
    if (!group.current) return;
    // Scroll carries the train across the frame while the language card is up
    // (it fills the open right side of the frame, clear of the card, around t ≈ 0.45).
    group.current.position.x = -62 + localT(INDEX) * 190;
  });

  return (
    <group ref={group} position={[0, DECK_Y + 0.35, VIADUCT_Z]}>
      {/* Lead car nose points in the direction of travel (+x) */}
      <group position={[0, 0, 0]} scale={[-1, 1, 1]}>
        <mesh geometry={nose}>
          <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.1} />
        </mesh>
      </group>
      {Array.from({ length: CARS }, (_, i) => {
        const x = -(i + 0.5) * CAR_LEN;
        return (
          <group key={i} position={[x, 0.78, 0]}>
            <mesh geometry={car}>
              <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.1} />
            </mesh>
            {[-1, 1].map((side) => (
              <group key={side}>
                <mesh position={[0, 0.22, side * 0.75]}>
                  <boxGeometry args={[CAR_LEN - 0.6, 0.34, 0.02]} />
                  <meshStandardMaterial color={GLASS} roughness={0.2} />
                </mesh>
                <mesh position={[0, -0.22, side * 0.75]}>
                  <boxGeometry args={[CAR_LEN - 0.2, 0.12, 0.02]} />
                  <meshStandardMaterial color={STRIPE} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
      {/* Tail nose */}
      <group position={[-CARS * CAR_LEN, 0, 0]}>
        <mesh geometry={nose}>
          <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

function Viaduct() {
  const pillars = useMemo(() => {
    const out: number[] = [];
    for (let x = -200; x <= 200; x += 12) if (Math.abs(x - 6) > 3) out.push(x);
    return out;
  }, []);

  return (
    <group position={[0, 0, VIADUCT_Z]}>
      <mesh position={[0, DECK_Y, 0]}>
        <boxGeometry args={[420, 0.7, 3.6]} />
        <meshStandardMaterial color="#D9C2CA" roughness={0.9} />
      </mesh>
      <mesh position={[0, DECK_Y + 0.5, 1.7]}>
        <boxGeometry args={[420, 0.5, 0.12]} />
        <meshStandardMaterial color="#C7AEB8" roughness={0.9} />
      </mesh>
      <instancedMesh
        ref={(m) => {
          if (!m) return;
          const d = new THREE.Object3D();
          pillars.forEach((x, i) => {
            d.position.set(x, DECK_Y / 2, 0);
            d.updateMatrix();
            m.setMatrixAt(i, d.matrix);
          });
          m.instanceMatrix.needsUpdate = true;
        }}
        args={[undefined, undefined, pillars.length]}
      >
        <boxGeometry args={[1.1, DECK_Y, 2.2]} />
        <meshStandardMaterial color="#BFA3AE" roughness={1} />
      </instancedMesh>
      {/* Catenary posts and wire */}
      <instancedMesh
        ref={(m) => {
          if (!m) return;
          const d = new THREE.Object3D();
          pillars.forEach((x, i) => {
            d.position.set(x, DECK_Y + 2.2, -1.6);
            d.updateMatrix();
            m.setMatrixAt(i, d.matrix);
          });
          m.instanceMatrix.needsUpdate = true;
        }}
        args={[undefined, undefined, pillars.length]}
      >
        <boxGeometry args={[0.12, 3.8, 0.12]} />
        <meshStandardMaterial color="#6E5A64" />
      </instancedMesh>
      <mesh position={[0, DECK_Y + 3.6, -0.6]}>
        <boxGeometry args={[420, 0.04, 0.04]} />
        <meshBasicMaterial color="#3A2430" />
      </mesh>
    </group>
  );
}

/** Harvest-gold paddies in strips, with a soft ridge line between them. */
function Paddies() {
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const rows = ['#E9B880', '#F0C27B', '#E2A88A', '#EDC296'];
      rows.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, i * 64, 64, 62);
      });
      ctx.fillStyle = '#B98A7A';
      for (let i = 0; i < 4; i++) ctx.fillRect(0, i * 64 + 62, 64, 2);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(40, 18);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, -60]}>
      <planeGeometry args={[600, 400]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
}

/** Scene 2: a Shinkansen crossing a viaduct at golden hour, Fuji behind. Answers "What about language?". */
export function ShinkansenScene({ trees }: { trees: number }) {
  const group = useSceneGroup(INDEX);
  return (
    <group ref={group}>
      <Sun position={[-70, 26, -260]} radius={14} color="#F6C58E" />
      <Fuji position={[20, 0, -175]} scale={1.15} />
      <Paddies />
      <mesh rotation-x={-Math.PI / 2} position={[6, 0.02, -15]}>
        <planeGeometry args={[2.2, 80]} />
        <meshStandardMaterial color="#C69AA8" roughness={1} />
      </mesh>
      <SakuraTrees
        count={Math.round(trees * 0.6)}
        seed={21}
        x={[4, 22]}
        z={[10, -60]}
        size={[0.5, 0.9]}
      />
      <Viaduct />
      <Train />
      <GlowGate position={[6, 0, 11]} scale={1.15} lanterns={false} portal />
      <GlowGate position={[6, 0, END_Z + 2]} scale={1.15} portal />
    </group>
  );
}

/**
 * Walk the lane towards the viaduct, stop to watch the train cross with Fuji
 * behind it while the card flips, then pass under the tracks to the portal.
 */
export const shinkansenCamera: CameraPath = (t, pos, look) => {
  const approach = smooth(0, 0.6, t);
  const pass = smooth(0.6, 1, t);
  const z = THREE.MathUtils.lerp(START_Z, VIADUCT_Z + 10, approach);
  pos.set(6 - 1.5 * (1 - approach), 2 + approach * 0.6, THREE.MathUtils.lerp(z, END_Z, pass));
  pos.y = THREE.MathUtils.lerp(pos.y, 1.8, pass);
  // Aim right of the lane so the train crosses the open side of the frame, clear of the card.
  look.set(
    THREE.MathUtils.lerp(11, 6, pass),
    THREE.MathUtils.lerp(7.5, 2, pass),
    THREE.MathUtils.lerp(VIADUCT_Z - 30, END_Z - 12, pass),
  );
};

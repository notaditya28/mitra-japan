import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { palette } from '../../styles/tokens';
import { rng, smooth, useSceneGroup, type CameraPath } from '../journey/common';
import { GlowGate } from '../journey/Gates';
import { signTexture } from '../journey/signs';

const VIEW = 'matsuri';
const START_Z = 13.5;
// Stop well short of the yagura so the upward look clears its roof.
const END_Z = -9;
const YAGURA_Z = -28;
const STALL_FOODS = [
  'たこ焼き',
  '焼きそば',
  'かき氷',
  'りんご飴',
  'わたあめ',
  'お面',
  '金魚すくい',
  'ヨーヨー',
  'とうもろこし',
  'ラムネ',
];
const NOREN = [palette.torii, '#FFF8FA', palette.sakura, palette.gold];

function awningTexture(a: string, b: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect(i * 16, 0, 16, 16);
    }
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Stall({
  position,
  side,
  food,
  noren,
}: {
  position: [number, number, number];
  side: -1 | 1;
  food: string;
  noren: string;
}) {
  const awning = useMemo(() => awningTexture(palette.torii, '#FFF8FA'), []);
  const sign = useMemo(
    () =>
      signTexture({
        text: food,
        bg: noren,
        fg: noren === '#FFF8FA' ? palette.torii : '#FFF8FA',
        width: 512,
        height: 128,
      }),
    [food, noren],
  );
  return (
    <group position={position} rotation-y={-side * (Math.PI / 2)}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.8, 1, 1.2]} />
        <meshStandardMaterial color="#6B4A3A" roughness={0.9} />
      </mesh>
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} position={[x, 1.4, -0.4]}>
          <boxGeometry args={[0.08, 2.8, 0.08]} />
          <meshStandardMaterial color="#4A2A35" />
        </mesh>
      ))}
      <mesh position={[0, 2.8, 0.1]} rotation-x={0.35}>
        <boxGeometry args={[3, 0.06, 1.8]} />
        <meshStandardMaterial map={awning} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.35, 0.95]}>
        <planeGeometry args={[2.6, 0.62]} />
        <meshBasicMaterial map={sign} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* Warm bulb under the awning */}
      <mesh position={[0, 2.1, 0.4]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshBasicMaterial color="#FFE3B0" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Paper lanterns strung across the street on sagging lines: one instanced draw call. */
function LanternCanopy() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const lanterns = useMemo(() => {
    const out: { p: THREE.Vector3; c: string }[] = [];
    const r = rng(5);
    for (let z = 11; z > YAGURA_Z + 2; z -= 2.6) {
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const x = -4.2 + u * 8.4;
        const y = 4.6 - Math.sin(Math.PI * u) * 0.9;
        out.push({
          p: new THREE.Vector3(x, y, z),
          c: r() > 0.3 ? '#E2414F' : r() > 0.5 ? palette.gold : '#FFE9D2',
        });
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    lanterns.forEach((l, i) => {
      d.position.copy(l.p);
      d.scale.set(1, 1.3, 1);
      d.updateMatrix();
      ref.current?.setMatrixAt(i, d.matrix);
      ref.current?.setColorAt(i, c.set(l.c));
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [lanterns]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, lanterns.length]}>
      <sphereGeometry args={[0.2, 10, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Yagura() {
  const bunting = useMemo(() => awningTexture('#E2414F', '#FFF8FA'), []);
  return (
    <group position={[0, 0, YAGURA_Z]}>
      {[
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ].map(([x = 0, z = 0]) => (
        <mesh key={`${x}${z}`} position={[x, 2.2, z]}>
          <boxGeometry args={[0.24, 4.4, 0.24]} />
          <meshStandardMaterial color="#6B4A3A" />
        </mesh>
      ))}
      <mesh position={[0, 4.5, 0]}>
        <boxGeometry args={[4.8, 0.3, 4.8]} />
        <meshStandardMaterial color="#6B4A3A" />
      </mesh>
      <mesh position={[0, 3.9, 0]}>
        <boxGeometry args={[4.6, 0.9, 4.6]} />
        <meshStandardMaterial map={bunting} roughness={1} />
      </mesh>
      {/* Taiko drum */}
      <mesh position={[0, 5.3, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.8, 0.8, 1.1, 18]} />
        <meshStandardMaterial color="#8A3A2E" roughness={0.7} />
      </mesh>
      <mesh position={[0, 7.2, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[3.8, 1.6, 4]} />
        <meshStandardMaterial color="#3A2430" flatShading />
      </mesh>
    </group>
  );
}

const BURSTS = 5;
const SPARKS = 140;
const FIREWORK_COLORS = [palette.gold, palette.sakura, palette.petal, '#FFF8FA', '#FF8FB1'];

/** Looping firework bursts high above the festival. */
function Fireworks() {
  const points = useRef<(THREE.Points | null)[]>([]);
  const bursts = useMemo(() => {
    const r = rng(19);
    return Array.from({ length: BURSTS }, (_, b) => {
      const dirs = new Float32Array(SPARKS * 3);
      for (let i = 0; i < SPARKS; i++) {
        const u = r() * 2 - 1;
        const a = r() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        dirs.set([s * Math.cos(a), u, s * Math.sin(a)], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
      return {
        dirs,
        geo,
        center: new THREE.Vector3(-34 + b * 17 + r() * 6, 42 + r() * 16, -95 - r() * 25),
        radius: 9 + r() * 6,
        period: 3.2 + r() * 1.6,
        offset: r() * 4,
        color: FIREWORK_COLORS[b % FIREWORK_COLORS.length] ?? palette.gold,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    bursts.forEach((b, i) => {
      const pts = points.current[i];
      if (!pts) return;
      const phase = ((clock.elapsedTime + b.offset) % b.period) / b.period;
      const spread = 1 - Math.pow(1 - Math.min(1, phase * 1.6), 3);
      const attr = b.geo.getAttribute('position') as THREE.BufferAttribute;
      for (let s = 0; s < SPARKS; s++) {
        attr.setXYZ(
          s,
          b.center.x + (b.dirs[s * 3] ?? 0) * b.radius * spread,
          b.center.y + (b.dirs[s * 3 + 1] ?? 0) * b.radius * spread - phase * phase * 6,
          b.center.z + (b.dirs[s * 3 + 2] ?? 0) * b.radius * spread,
        );
      }
      attr.needsUpdate = true;
      const mat = pts.material as THREE.PointsMaterial;
      mat.opacity = phase < 0.05 ? phase * 20 : Math.max(0, 1 - (phase - 0.3) / 0.6);
    });
  });

  return (
    <>
      {bursts.map((b, i) => (
        <points
          key={i}
          ref={(p) => {
            points.current[i] = p;
          }}
          geometry={b.geo}
          frustumCulled={false}
        >
          <pointsMaterial
            color={b.color}
            size={0.9}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
            toneMapped={false}
          />
        </points>
      ))}
    </>
  );
}

/** Kyoto (Gion): a summer matsuri at night. Answers "Will it feel foreign?" and leads into the Indian roots. */
export function MatsuriScene() {
  const group = useSceneGroup(VIEW);
  const stalls = useMemo(() => {
    const out: { position: [number, number, number]; side: -1 | 1; food: string; noren: string }[] =
      [];
    let n = 0;
    for (let z = 8; z > YAGURA_Z + 4; z -= 4.2) {
      for (const side of [-1, 1] as const) {
        out.push({
          position: [side * 4, 0, z - (side === 1 ? 1.6 : 0)],
          side,
          food: STALL_FOODS[n % STALL_FOODS.length] ?? 'たこ焼き',
          noren: NOREN[n % NOREN.length] ?? palette.torii,
        });
        n++;
      }
    }
    return out;
  }, []);

  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -40]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#2A1826" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -8]}>
        <planeGeometry args={[6.4, 50]} />
        <meshStandardMaterial color="#4A2E3E" roughness={1} />
      </mesh>
      {stalls.map((s, i) => (
        <Stall key={i} {...s} />
      ))}
      <LanternCanopy />
      <Yagura />
      <Fireworks />
      <pointLight position={[0, 4, 2]} color="#FFB07A" intensity={14} distance={20} decay={1.4} />
      <pointLight position={[0, 4, -16]} color="#FFB07A" intensity={14} distance={20} decay={1.4} />
      <GlowGate position={[0, 0, 11]} scale={1.15} lanterns={false} portal />
    </group>
  );
}

/** Walk under the lantern canopy past the stalls, then look up as the fireworks open. */
export const matsuriCamera: CameraPath = (t, pos, look) => {
  const walk = smooth(0, 0.8, t);
  const z = THREE.MathUtils.lerp(START_Z, END_Z, walk);
  pos.set(Math.sin(t * 7) * 0.12, 1.7, z);
  const up = smooth(0.62, 0.95, t);
  look.set(0, THREE.MathUtils.lerp(2.3, 46, up), THREE.MathUtils.lerp(z - 10, -100, up));
};

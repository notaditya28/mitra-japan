import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { palette } from '../../styles/tokens';
import { rng, smooth, useSceneGroup, type CameraPath } from '../journey/common';
import { GlowGate } from '../journey/Gates';
import { signTexture } from '../journey/signs';

const INDEX = 1;
const FACADE_X = 4.8;
const STALL_Z = -18;
const START_Z = 13.5;
const END_Z = -48;
const STALL_LOOK = new THREE.Vector3(3.2, 1.7, STALL_Z);

const NEON = [palette.sakura, palette.gold, '#FF8FB1', palette.paper, palette.torii];
const SIGNS = [
  'ラーメン',
  '居酒屋',
  'カラオケ',
  '寿司',
  '喫茶',
  '焼鳥',
  '餃子',
  '薬局',
  '本屋',
  'ホテル',
];

function windowTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const r = rng(3);
  if (ctx) {
    ctx.fillStyle = '#1A1020';
    ctx.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 18) {
      for (let x = 8; x < w - 8; x += 20) {
        const lit = r();
        ctx.fillStyle =
          lit > 0.62 ? (lit > 0.85 ? '#FBE3C4' : '#F7C6D0') : lit > 0.45 ? '#4A3050' : '#24162A';
        ctx.fillRect(x, y, 12, 10);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Building {
  x: number;
  z: number;
  w: number;
  h: number;
  side: -1 | 1;
  color: string;
}

function useStreet() {
  return useMemo(() => {
    const r = rng(11);
    const buildings: Building[] = [];
    const signs: { pos: [number, number, number]; text: string; glow: string; side: -1 | 1 }[] = [];
    for (const side of [-1, 1] as const) {
      let z = 18;
      while (z > -64) {
        const w = 3.6 + r() * 3;
        const h = 7 + r() * 15;
        buildings.push({
          x: side * (FACADE_X + 3),
          z: z - w / 2,
          w,
          h,
          side,
          color: ['#3A2442', '#2E1C38', '#43284A', '#33203A'][Math.floor(r() * 4)] ?? '#33203A',
        });
        if (r() > 0.3) {
          signs.push({
            pos: [side * (FACADE_X - 0.45), 3.6 + r() * 3.5, z - w * (0.3 + r() * 0.4)],
            text: SIGNS[Math.floor(r() * SIGNS.length)] ?? 'ラーメン',
            glow: NEON[Math.floor(r() * NEON.length)] ?? palette.sakura,
            side,
          });
        }
        z -= w + 0.25;
      }
    }
    return { buildings, signs };
  }, []);
}

function Buildings({ buildings }: { buildings: Building[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.BoxGeometry(6, 1, 1).translate(0, 0.5, 0), []);
  const tex = useMemo(windowTexture, []);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    buildings.forEach((b, i) => {
      d.position.set(b.x, 0, b.z);
      d.scale.set(1, b.h, b.w);
      d.updateMatrix();
      ref.current?.setMatrixAt(i, d.matrix);
      ref.current?.setColorAt(i, c.set(b.color));
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    }
  }, [buildings]);

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, buildings.length]}>
      <meshStandardMaterial
        map={tex}
        emissiveMap={tex}
        emissive="#ffffff"
        emissiveIntensity={0.55}
        roughness={0.9}
      />
    </instancedMesh>
  );
}

function NeonSign({
  pos,
  text,
  glow,
  side,
}: {
  pos: [number, number, number];
  text: string;
  glow: string;
  side: -1 | 1;
}) {
  const tex = useMemo(
    () => signTexture({ text, vertical: true, bg: '#1A0F1E', fg: '#FFF8FA', glow, border: glow }),
    [text, glow],
  );
  return (
    <group>
      <mesh position={pos}>
        <planeGeometry args={[0.75, 2.8]} />
        <meshBasicMaterial map={tex} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* Bracket back to the facade */}
      <mesh position={[pos[0] + side * 0.32, pos[1] + 1.2, pos[2]]}>
        <boxGeometry args={[0.6, 0.06, 0.06]} />
        <meshBasicMaterial color="#120A16" />
      </mesh>
      {/* Fake wet-road reflection */}
      <mesh rotation-x={-Math.PI / 2} position={[side * 3, 0.02, pos[2]]}>
        <planeGeometry args={[1, 4.5]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function VendingMachine({ z, side }: { z: number; side: -1 | 1 }) {
  const tex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFF8FA';
      ctx.fillRect(0, 0, 64, 128);
      const cols = [palette.sakura, palette.gold, palette.torii, '#8A6B77', palette.petal];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.fillStyle = cols[(row * 4 + col) % cols.length] ?? '#D9577F';
          ctx.fillRect(6 + col * 14, 8 + row * 20, 9, 15);
        }
      }
      ctx.fillStyle = '#3A2430';
      ctx.fillRect(6, 96, 52, 20);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const x = side * (FACADE_X - 0.45);
  return (
    <group position={[x, 0, z]} rotation-y={-side * (Math.PI / 2)}>
      <mesh position={[0, 0.9, -0.01]}>
        <boxGeometry args={[0.9, 1.8, 0.7]} />
        <meshStandardMaterial color={palette.torii} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1, 0.36]}>
        <planeGeometry args={[0.74, 1.4]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RamenStall() {
  const noren = useMemo(
    () => signTexture({ text: 'らーめん', bg: '#C0394B', fg: '#FFF8FA', width: 512, height: 160 }),
    [],
  );
  const lantern = useMemo(
    () =>
      signTexture({
        text: 'ラーメン',
        vertical: true,
        bg: '#D23A4E',
        fg: '#2A1218',
        width: 128,
        height: 256,
      }),
    [],
  );
  return (
    <group position={[3.4, 0, STALL_Z]} rotation-y={-Math.PI / 2}>
      <mesh position={[0, 0.5, 0.2]}>
        <boxGeometry args={[2.6, 1, 1]} />
        <meshStandardMaterial color="#6B4A3A" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[3, 0.14, 1.8]} />
        <meshStandardMaterial color="#2A1820" roughness={0.9} />
      </mesh>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 1.25, -0.2]}>
          <boxGeometry args={[0.1, 2.5, 0.1]} />
          <meshStandardMaterial color="#4A2A35" />
        </mesh>
      ))}
      <mesh position={[0, 2.05, 0.92]}>
        <planeGeometry args={[2.8, 0.8]} />
        <meshBasicMaterial map={noren} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {[-1.25, 1.25].map((x) => (
        <mesh key={x} position={[x, 1.9, 1.05]} scale={[1, 1.35, 1]}>
          <cylinderGeometry args={[0.24, 0.24, 0.5, 14]} />
          <meshBasicMaterial map={lantern} toneMapped={false} />
        </mesh>
      ))}
      <pointLight
        position={[0, 1.8, 1.6]}
        color={palette.gold}
        intensity={10}
        distance={9}
        decay={1.5}
      />
    </group>
  );
}

function TokyoTower() {
  const bands: [number, number, number, number, string][] = [
    // [y, height, radiusTop, radiusBottom, colour]
    [0, 14, 4.6, 7, palette.torii],
    [14, 14, 3, 4.6, palette.paper],
    [28, 12, 1.9, 3, palette.torii],
    [40, 12, 1.1, 1.9, palette.paper],
    [52, 12, 0.5, 1.1, palette.torii],
    [64, 14, 0.12, 0.5, palette.paper],
  ];
  return (
    <group position={[6, 0, -150]}>
      {bands.map(([y, h, rt, rb, color]) => (
        <mesh key={y} position={[0, y + h / 2, 0]} rotation-y={Math.PI / 4}>
          <cylinderGeometry args={[rt, rb, h, 4, 1, true]} />
          <meshBasicMaterial color={color} wireframe toneMapped={false} />
        </mesh>
      ))}
      {[26, 46].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[y === 26 ? 7 : 3.4, 2, y === 26 ? 7 : 3.4]} />
          <meshBasicMaterial color={palette.gold} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Wires() {
  const line = useMemo(() => {
    const pts: number[] = [];
    for (const side of [-1, 1]) {
      for (let z = 14; z > -56; z -= 14) {
        const a = new THREE.Vector3(side * 4.4, 7.6, z);
        const b = new THREE.Vector3(-side * 4.4, 7.6, z - 7);
        const c = new THREE.Vector3(side * 4.4, 7.6, z - 14);
        for (const [p, q] of [
          [a, b],
          [a, c],
        ] as const) {
          for (let i = 0; i < 12; i++) {
            const t0 = i / 12;
            const t1 = (i + 1) / 12;
            const s0 = p
              .clone()
              .lerp(q, t0)
              .setY(7.6 - Math.sin(Math.PI * t0) * 0.7);
            const s1 = p
              .clone()
              .lerp(q, t1)
              .setY(7.6 - Math.sin(Math.PI * t1) * 0.7);
            pts.push(...s0.toArray(), ...s1.toArray());
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#0C060E' }));
  }, []);
  const poles = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const side of [-1, 1]) for (let z = 14; z > -56; z -= 14) out.push([side * 4.4, 3.8, z]);
    return out;
  }, []);
  return (
    <>
      <primitive object={line} />
      {poles.map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.08, 0.1, 7.6, 6]} />
          <meshStandardMaterial color="#1A1020" />
        </mesh>
      ))}
    </>
  );
}

/** Scene 1: Tokyo neon street at night. Answers "Will I find veg food?" at the ramen stall. */
export function TokyoScene() {
  const group = useSceneGroup(INDEX);
  const { buildings, signs } = useStreet();
  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -30]}>
        <planeGeometry args={[60, 200]} />
        <meshStandardMaterial color="#1E1420" roughness={0.45} metalness={0.2} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} rotation-x={-Math.PI / 2} position={[side * 3.9, 0.06, -25]}>
          <planeGeometry args={[1.8, 100]} />
          <meshStandardMaterial color="#3A2A36" roughness={0.9} />
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-2.7 + i * 0.9, 0.03, 7]}>
          <planeGeometry args={[0.45, 3]} />
          <meshBasicMaterial color="#E8DDE2" transparent opacity={0.75} />
        </mesh>
      ))}
      <Buildings buildings={buildings} />
      {signs.map((s, i) => (
        <NeonSign key={i} {...s} />
      ))}
      {[4, -8, -27, -38].map((z, i) => (
        <VendingMachine key={z} z={z} side={i % 2 === 0 ? -1 : 1} />
      ))}
      <RamenStall />
      <Wires />
      <TokyoTower />
      <pointLight
        position={[0, 6, -2]}
        color={palette.sakura}
        intensity={8}
        distance={16}
        decay={1.4}
      />
      <pointLight
        position={[0, 6, -34]}
        color={palette.gold}
        intensity={8}
        distance={16}
        decay={1.4}
      />
      <GlowGate position={[0, 0, 11]} scale={1.15} lanterns={false} portal />
      <GlowGate position={[0, 0, END_Z + 2]} scale={1.15} portal />
    </group>
  );
}

/** Stroll down the street, glance at the ramen stall while its card flips, then into the exit portal. */
export const tokyoCamera: CameraPath = (t, pos, look) => {
  const z = THREE.MathUtils.lerp(START_Z, END_Z, t);
  pos.set(Math.sin(t * 9) * 0.15, 1.7, z);
  look.set(0, 2.2, z - 10);
  // Turn towards the ramen stall while its card flips (camera passes it at t ≈ 0.51).
  const glance = smooth(0.26, 0.38, t) * (1 - smooth(0.46, 0.53, t));
  look.lerp(STALL_LOOK, glance * 0.85);
};

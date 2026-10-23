import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { palette } from '../../styles/tokens';

const PEAK = 28.6;
let fujiCache: THREE.BufferGeometry | null = null;

/** Low-poly lathe Fuji with a jagged snow line baked into per-face colours. Built once. */
function fujiGeometry(): THREE.BufferGeometry {
  if (fujiCache) return fujiCache;
  const profile = [
    [64, 0],
    [44, 3.5],
    [30, 8],
    [19, 14],
    [11, 20],
    [6.5, 25],
    [3.6, PEAK - 0.4],
    [0, PEAK],
  ].map(([x = 0, y = 0]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 16).toNonIndexed();
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const body = new THREE.Color('#9A6283');
  const shade = new THREE.Color('#6E3A5C');
  const snow = new THREE.Color(palette.paper);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    let y = 0;
    let angle = 0;
    for (let j = 0; j < 3; j++) {
      y += pos.getY(i + j) / 3;
      angle += Math.atan2(pos.getZ(i + j), pos.getX(i + j)) / 3;
    }
    const snowLine = 19.5 + Math.sin(angle * 5) * 2.2 + Math.cos(angle * 3) * 1.2;
    if (y > snowLine) c.copy(snow);
    else c.copy(body).lerp(shade, Math.max(0, Math.sin(angle * 2 + 1)) * 0.5);
    for (let j = 0; j < 3; j++) c.toArray(colors, (i + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  fujiCache = geo;
  return geo;
}

export function Fuji({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <mesh geometry={fujiGeometry()} position={position} scale={scale}>
      {/* Lathe faces point inward; render both sides. */}
      <meshStandardMaterial vertexColors flatShading roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

let haloCache: THREE.CanvasTexture | null = null;
function haloTexture(): THREE.CanvasTexture {
  if (haloCache) return haloCache;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(240,194,123,0.85)');
    g.addColorStop(0.35, 'rgba(240,194,123,0.35)');
    g.addColorStop(1, 'rgba(240,194,123,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  haloCache = new THREE.CanvasTexture(canvas);
  haloCache.colorSpace = THREE.SRGBColorSpace;
  return haloCache;
}

interface SunProps {
  position: [number, number, number];
  radius?: number;
  color?: string;
  /** Optional per-frame y offset (e.g. dawn rise). */
  rise?: () => number;
}

/** Flat sun disc with a soft halo, unaffected by fog. */
export function Sun({ position, radius = 11, color = palette.gold, rise }: SunProps) {
  const ref = useRef<THREE.Group>(null);
  const halo = useMemo(haloTexture, []);
  useFrame(() => {
    if (ref.current && rise) ref.current.position.y = position[1] + rise();
  });
  return (
    <group ref={ref} position={position}>
      <mesh>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color={color} fog={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[radius * 7, radius * 7]} />
        <meshBasicMaterial map={halo} transparent depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

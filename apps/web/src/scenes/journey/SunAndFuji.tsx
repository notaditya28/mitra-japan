import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { palette } from '../../styles/tokens';
import { journey } from '../journeyState';

const FUJI_Z = -150;
const PEAK = 28.6;

/** Low-poly lathe Fuji with a jagged snow line baked into vertex colours. */
function useFujiGeometry() {
  return useMemo(() => {
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
    // Colour per triangle so faces stay crisp and low-poly.
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
    return geo;
  }, []);
}

function useHaloTexture() {
  return useMemo(() => {
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
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

export function SunAndFuji() {
  const fuji = useFujiGeometry();
  const halo = useHaloTexture();
  const sun = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!sun.current) return;
    // Dawn rise on load, then a little more as you scroll into the journey.
    const t = journey.intro;
    const eased = 1 - Math.pow(1 - t, 3);
    sun.current.position.y = 22 + eased * 36 + journey.persona * 3;
  });

  return (
    <group>
      <group ref={sun} position={[0, 22, -230]}>
        <mesh>
          <circleGeometry args={[11, 48]} />
          <meshBasicMaterial color={palette.gold} fog={false} />
        </mesh>
        <mesh position={[0, 0, -1]}>
          <planeGeometry args={[80, 80]} />
          <meshBasicMaterial map={halo} transparent depthWrite={false} fog={false} />
        </mesh>
      </group>
      <mesh geometry={fuji} position={[0, 0, FUJI_Z]} scale={1.3}>
        <meshStandardMaterial vertexColors flatShading roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

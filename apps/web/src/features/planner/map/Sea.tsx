import { useMemo } from 'react';
import * as THREE from 'three';
import { seigaihaSvg } from '../../../lib/seigaiha';
import { palette } from '../../../styles/tokens';

/** Plum sea with a faint seigaiha wave texture, tiled across the plane. */
export function Sea() {
  const texture = useMemo(() => {
    const svg = seigaihaSvg({
      line: palette.paper,
      bg: palette.plum,
      lineOpacity: 0.22,
      radius: 32,
    });
    const img = new Image();
    const tex = new THREE.Texture(img);
    img.onload = () => {
      tex.needsUpdate = true;
    };
    img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    // ~2 world units per wave so the pattern survives mipmapping in the overview.
    tex.repeat.set(60, 120);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial map={texture} color="#ffffff" roughness={1} />
    </mesh>
  );
}

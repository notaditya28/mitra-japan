import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SEGMENTS, type Spot } from '../../features/tour/tour';
import { stage } from '../journeyState';
import { smooth, useSceneGroup, type CameraPath } from './common';

/** Photo space sits well away from the map and the train so nothing overlaps. */
const ORIGIN_Y = 400;
const DISTANCE = 20;
const FOV = 50;
/** Extra cover so the dolly, drift and pointer parallax never show an edge. */
const MARGIN = 1.22;
/** How far the photo's left and right edges curve towards the viewer. */
const BEND = 2.4;

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

/** Phones and mid-tier devices get the 1280 px copy, big screens the 2048 px one. */
const urlFor = (spot: Spot, large: boolean) => (large ? spot.src.lg : spot.src.sm);

function texture(url: string): THREE.Texture {
  let tex = cache.get(url);
  if (!tex) {
    tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    cache.set(url, tex);
  }
  return tex;
}

const loaded = (tex: THREE.Texture) => Boolean((tex.image as HTMLImageElement | undefined)?.width);

/** Crop the photo to the plane (CSS "cover"), keeping its point of interest in frame. */
function cover(tex: THREE.Texture, spot: Spot, aspect: number) {
  const img = spot.width / spot.height;
  const [fx, fy] = spot.focus;
  tex.repeat.set(1, 1);
  tex.offset.set(0, 0);
  if (img > aspect) {
    const r = aspect / img;
    tex.repeat.x = r;
    tex.offset.x = Math.min(1 - r, Math.max(0, fx - r / 2));
  } else {
    const r = img / aspect;
    tex.repeat.y = r;
    // UV y runs bottom-up.
    tex.offset.y = Math.min(1 - r, Math.max(0, 1 - fy - r / 2));
  }
}

/**
 * The spot photos. One curved plane shows the active spot's photo; the next two
 * spots preload. Textures swap under the portal veil, so the cut is never seen.
 */
export function PhotoScene({ large }: { large: boolean }) {
  const group = useSceneGroup('spot');
  const mesh = useRef<THREE.Mesh>(null);
  const size = useThree((s) => s.size);
  const shown = useRef<{ url: string; aspect: number } | null>(null);

  const { geometry, aspect } = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const h = 2 * DISTANCE * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * MARGIN;
    const w = h * aspect;
    const g = new THREE.PlaneGeometry(w, h, 48, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (w / 2);
      p.setZ(i, x * x * BEND);
    }
    p.needsUpdate = true;
    return { geometry: g, aspect };
  }, [size.width, size.height]);

  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m || stage.kind !== 'spot') return;
    // The portal widens the field of view; grow the photo with it so no edge shows.
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const grow =
      Math.tan(THREE.MathUtils.degToRad(fov / 2)) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    m.scale.setScalar(Math.max(1, grow));
    const seg = SEGMENTS[stage.scene];
    if (seg?.kind !== 'spot') return;
    const url = urlFor(seg.spot, large);
    const tex = texture(url);
    const mat = m.material as THREE.MeshBasicMaterial;
    if (shown.current?.url !== url || shown.current.aspect !== aspect) {
      cover(tex, seg.spot, aspect);
      shown.current = { url, aspect };
    }
    const ready = loaded(tex);
    if (mat.map !== (ready ? tex : null)) {
      mat.map = ready ? tex : null;
      // Plum until the photo arrives, never a white flash.
      mat.color.set(ready ? '#ffffff' : '#3A1A2E');
      mat.needsUpdate = true;
    }
    // Warm the cache for what comes next.
    for (let i = stage.scene + 1; i <= stage.scene + 2; i++) {
      const next = SEGMENTS[i];
      if (next?.kind === 'spot') texture(urlFor(next.spot, large));
    }
  });

  return (
    <group ref={group} position={[0, ORIGIN_Y, -DISTANCE]}>
      <mesh ref={mesh} geometry={geometry}>
        <meshBasicMaterial color="#3A1A2E" toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}

/** Start the warm-up for the first city's photos (called once the canvas mounts). */
export function preloadFirstSpots(large: boolean, count = 2) {
  SEGMENTS.filter((s) => s.kind === 'spot')
    .slice(0, count)
    .forEach((s) => {
      if (s.kind === 'spot') texture(urlFor(s.spot, large));
    });
}

/** A slow push in with a sideways drift, as if walking up to the view. */
export const photoCamera: CameraPath = (t, pos, look) => {
  const k = smooth(0, 1, t);
  // Narrow (portrait) screens have less spare photo at the sides, so drift less.
  const aspect = typeof window === 'undefined' ? 1.6 : window.innerWidth / window.innerHeight;
  const drift = 0.8 * Math.min(1, aspect / 1.6);
  const x = THREE.MathUtils.lerp(-drift, drift, t);
  pos.set(x, ORIGIN_Y + THREE.MathUtils.lerp(0.35, -0.2, k), THREE.MathUtils.lerp(2.5, -2.5, k));
  look.set(x * 0.35, ORIGIN_Y, -DISTANCE);
};

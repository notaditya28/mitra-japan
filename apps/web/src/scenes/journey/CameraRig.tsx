import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { journey, TUNNEL_END_Z, TUNNEL_START_Z } from '../journeyState';

const smooth = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

// Keyframes: hero looks up at Fuji and the sun over the gate row; persona
// settles at the tunnel mouth; the tunnel dollies through every gate.
const HERO_POS = new THREE.Vector3(0, 2.6, 19);
const HERO_LOOK = new THREE.Vector3(0, 17, -42);
const MOUTH_POS = new THREE.Vector3(0, 1.85, TUNNEL_START_Z);
const MOUTH_LOOK = new THREE.Vector3(0, 4.5, -40);

/** Scroll-driven camera with critically-damped smoothing and soft pointer parallax. */
export function CameraRig() {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const currentLook = useMemo(() => HERO_LOOK.clone(), []);

  useFrame(({ camera }, dt) => {
    const { hero, persona, tunnel, pointer } = journey;

    if (tunnel > 0) {
      const z = THREE.MathUtils.lerp(TUNNEL_START_Z, TUNNEL_END_Z, tunnel);
      // Lift slightly at the very end, ready for the roots reveal.
      const lift = smooth(0.92, 1, tunnel);
      pos.set(0, 1.85 + lift * 2.5, z);
      const settle = smooth(0, 0.08, tunnel);
      look.set(0, THREE.MathUtils.lerp(4.5, 1.95, settle) + lift * 6, z - 12);
    } else {
      // Hero drift then persona glide to the tunnel mouth.
      pos.copy(HERO_POS).setZ(HERO_POS.z - hero * 2.5);
      look.copy(HERO_LOOK);
      const p = smooth(0, 1, persona);
      pos.lerp(MOUTH_POS, p);
      look.lerp(MOUTH_LOOK, p);
    }

    const parallax = tunnel > 0 ? 0.12 : 0.6;
    pos.x += pointer.x * parallax;
    pos.y += pointer.y * parallax * 0.4;

    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3.2);
    camera.position.lerp(pos, k);
    currentLook.lerp(look, k);
    camera.lookAt(currentLook);
  });

  return null;
}

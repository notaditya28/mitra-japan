import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeStage, journey, stage } from '../journeyState';
import type { CameraPath } from './common';
import { fujiCamera } from '../places/FujiScene';
import { tokyoCamera } from '../places/TokyoScene';
import { shinkansenCamera } from '../places/ShinkansenScene';
import { kyotoCamera } from '../places/KyotoScene';
import { matsuriCamera } from '../places/MatsuriScene';

const CAMERAS: CameraPath[] = [
  fujiCamera,
  tokyoCamera,
  shinkansenCamera,
  kyotoCamera,
  matsuriCamera,
];
const BASE_FOV = 50;

/**
 * Directs the journey: derives the stage from scroll each frame (it must run
 * first, so it is mounted first), follows the active scene's camera path with
 * damped smoothing, snaps on scene changes, and applies the portal speed warp.
 */
export function CameraRig() {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const currentLook = useMemo(() => new THREE.Vector3(0, 17, -42), []);

  useFrame(({ camera }, dt) => {
    computeStage();
    const path = CAMERAS[stage.scene] ?? fujiCamera;
    path(stage.t, pos, look);

    const parallax = stage.scene === 0 ? 0.6 : 0.18;
    pos.x += journey.pointer.x * parallax;
    pos.y += journey.pointer.y * parallax * 0.4;

    if (stage.switched) {
      camera.position.copy(pos);
      currentLook.copy(look);
    } else {
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3.2);
      camera.position.lerp(pos, k);
      currentLook.lerp(look, k);
    }
    camera.lookAt(currentLook);

    const persp = camera as THREE.PerspectiveCamera;
    const fov = BASE_FOV + stage.warp;
    if (Math.abs(persp.fov - fov) > 0.01) {
      persp.fov = fov;
      persp.updateProjectionMatrix();
    }
  });

  return null;
}

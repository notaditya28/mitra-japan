import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeStage, journey, stage, type ViewId } from '../journeyState';
import type { CameraPath } from './common';
import { flightCamera } from './FlightScene';
import { shinkansenCamera } from './ShinkansenScene';
import { fujiCamera } from '../places/FujiScene';
import { kyotoCamera } from '../places/KyotoScene';
import { matsuriCamera } from '../places/MatsuriScene';
import { tokyoCamera } from '../places/TokyoScene';

const CAMERAS: Record<ViewId, CameraPath> = {
  flight: flightCamera,
  train: shinkansenCamera,
  tokyo: tokyoCamera,
  fuji: fujiCamera,
  kyoto: kyotoCamera,
  matsuri: matsuriCamera,
};
const PARALLAX: Record<ViewId, number> = {
  flight: 0.6,
  train: 0.18,
  tokyo: 0.18,
  fuji: 0.3,
  kyoto: 0.18,
  matsuri: 0.18,
};
const BASE_FOV = 50;

/**
 * Directs the journey: derives the stage from scroll each frame (it must run
 * first, so it is mounted first), follows the active scene's camera path with
 * damped smoothing, snaps on scene changes, and applies the portal speed warp.
 */
export function CameraRig() {
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const currentLook = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useFrame(({ camera }, dt) => {
    computeStage();
    CAMERAS[stage.view](stage.t, pos, look);

    const parallax = PARALLAX[stage.view];
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

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeStage, journey, stage, type SegmentKind } from '../journeyState';
import type { CameraPath } from './common';
import { flightCamera } from './FlightScene';
import { photoCamera } from './PhotoScene';
import { shinkansenCamera } from './ShinkansenScene';

const CAMERAS: Record<SegmentKind, CameraPath> = {
  flight: flightCamera,
  spot: photoCamera,
  train: shinkansenCamera,
};
const PARALLAX: Record<SegmentKind, number> = { flight: 0.6, spot: 0.22, train: 0.18 };
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
    CAMERAS[stage.kind](stage.t, pos, look);

    const parallax = PARALLAX[stage.kind];
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

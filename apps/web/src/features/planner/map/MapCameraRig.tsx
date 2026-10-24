import { useEffect, useMemo, useRef, type ElementRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { cityById } from '../data';
import { usePlannerStore } from '../usePlannerStore';
import { lngLatToWorld, MAP_HALF } from './mapSpace';

const HOME_TARGET = new THREE.Vector3(1, 0, 1.5);
const HOME_OFFSET = new THREE.Vector3(0, 21, 17);
const CITY_OFFSET = new THREE.Vector3(0, 7, 6);
const STOP_OFFSET = new THREE.Vector3(0, 3.2, 2.8);

/**
 * Orbit controls with sensible limits (team guide: polar angle 0.2-1.25 rad, so the camera
 * never dips under the sea), plus a smooth cubic fly-to whenever the selected city or the
 * clicked stop changes, and back to the whole of Japan on reset.
 */
export function MapCameraRig({ selectedCityId }: { selectedCityId: string | null }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  // On portrait screens the bottom sheet covers the lower half: aim south of the
  // city so it lands in the visible top half.
  const portraitShift = size.width < size.height ? 2.6 : 0;
  const fly = useRef<{ target: THREE.Vector3; position: THREE.Vector3; t: number } | null>(null);
  const fromTarget = useMemo(() => new THREE.Vector3(), []);
  const fromPos = useMemo(() => new THREE.Vector3(), []);
  const stop = usePlannerStore((s) => s.focusedStop);
  const resetView = usePlannerStore((s) => s.resetView);

  useEffect(() => {
    const ctl = controls.current;
    if (!ctl) return;
    const city = selectedCityId ? cityById(selectedCityId) : undefined;
    let target: THREE.Vector3;
    let position: THREE.Vector3;
    if (stop) {
      const [x, z] = lngLatToWorld(stop.lng, stop.lat);
      target = new THREE.Vector3(x, 0, z + portraitShift * 0.5);
      position = target.clone().add(STOP_OFFSET);
    } else if (city) {
      const [x, z] = lngLatToWorld(city.lng, city.lat);
      target = new THREE.Vector3(x, 0, z + portraitShift);
      position = target.clone().add(CITY_OFFSET);
    } else {
      target = HOME_TARGET.clone();
      position = HOME_TARGET.clone().add(HOME_OFFSET);
    }
    fromTarget.copy(ctl.target);
    fromPos.copy(camera.position);
    fly.current = { target, position, t: 0 };
  }, [selectedCityId, stop, resetView, camera, fromTarget, fromPos, portraitShift]);

  useFrame((_, dt) => {
    const ctl = controls.current;
    if (!ctl) return;
    const f = fly.current;
    if (f) {
      f.t = Math.min(1, f.t + dt / 1.2);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2;
      ctl.target.lerpVectors(fromTarget, f.target, e);
      camera.position.lerpVectors(fromPos, f.position, e);
      if (f.t >= 1) fly.current = null;
    }
    // Keep the focus point on (or near) the map.
    ctl.target.x = THREE.MathUtils.clamp(ctl.target.x, -MAP_HALF, MAP_HALF);
    ctl.target.z = THREE.MathUtils.clamp(ctl.target.z, -MAP_HALF, MAP_HALF);
    ctl.target.y = 0;
    ctl.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={5}
      maxDistance={40}
      minPolarAngle={0.2}
      maxPolarAngle={1.25}
      screenSpacePanning={false}
      onStart={() => {
        // The user grabbed the camera: cancel any fly-to in progress.
        fly.current = null;
      }}
    />
  );
}

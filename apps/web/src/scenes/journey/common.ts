import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { stage, type ViewId } from '../journeyState';

/** Seeded PRNG so every scene is identical on every load. */
export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/** Writes camera position and look-at target for local progress t (0..1). */
export type CameraPath = (t: number, pos: THREE.Vector3, look: THREE.Vector3) => void;

/** A scene group that is only visible (and therefore only rendered) while its view is on screen. */
export function useSceneGroup(view: ViewId) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = stage.view === view;
  });
  return ref;
}

/** Local progress for a view, 0 when inactive. */
export function localT(view: ViewId): number {
  return stage.view === view ? stage.t : 0;
}

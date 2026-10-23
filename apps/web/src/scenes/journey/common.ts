import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { stage } from '../journeyState';

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

/** A scene group that is only visible (and therefore only rendered) while it is the active scene. */
export function useSceneGroup(index: number) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = stage.scene === index;
  });
  return ref;
}

/** Local progress for a scene, 0 when inactive. */
export function localT(index: number): number {
  return stage.scene === index ? stage.t : 0;
}

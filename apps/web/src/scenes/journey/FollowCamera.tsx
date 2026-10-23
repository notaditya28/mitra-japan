import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

/** Keeps its children positioned relative to the camera (e.g. petals around the viewer). */
export function FollowCamera({
  children,
  offset = [0, 0, -6],
}: {
  children: ReactNode;
  offset?: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    group.current?.position.set(
      camera.position.x + offset[0],
      camera.position.y + offset[1],
      camera.position.z + offset[2],
    );
  });
  return <group ref={group}>{children}</group>;
}

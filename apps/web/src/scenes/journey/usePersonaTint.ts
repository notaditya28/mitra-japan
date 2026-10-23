import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { tintFor } from '../../features/persona/personas';
import { useAppStore } from '../../store/useAppStore';

function toColor(rgb: string): THREE.Color {
  const [r = 217, g = 87, b = 127] = rgb.split(' ').map(Number);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

/** Persona tint as a THREE.Color ref, updated without re-rendering the scene. */
export function usePersonaTint() {
  const ref = useRef(toColor(tintFor(useAppStore.getState().persona)));
  useEffect(
    () =>
      useAppStore.subscribe((s, prev) => {
        if (s.persona !== prev.persona) ref.current = toColor(tintFor(s.persona));
      }),
    [],
  );
  return ref;
}

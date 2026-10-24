import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { stage } from '../journeyState';

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Deep plum, a touch warmer in the middle, so the dip reads as dusk, never a flash.
const fragment = /* glsl */ `
  uniform float uCover;
  uniform float uAspect;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    vec3 centre = vec3(0.18, 0.08, 0.14);
    vec3 edge = vec3(0.10, 0.047, 0.094);
    vec3 col = mix(centre, edge, clamp(length(p) * 1.3, 0.0, 1.0));
    gl_FragColor = vec4(col, uCover);
  }
`;

/**
 * The transition between segments of the journey: a slow dip to deep plum (the
 * page's own night colour), the cut while the screen is dark, then a slow rise into
 * the next scene. Camera-attached and drawn last.
 */
export function SceneFade() {
  const veil = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uCover: { value: 0 }, uAspect: { value: 1 } }), []);

  useFrame(({ size }) => {
    const v = veil.current;
    if (!v) return;
    v.visible = stage.cover > 0.001;
    uniforms.uCover.value = stage.cover;
    uniforms.uAspect.value = size.width / size.height;
  });

  return (
    <mesh ref={veil} frustumCulled={false} renderOrder={998} visible={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

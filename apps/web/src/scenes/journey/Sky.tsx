import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { journey } from '../journeyState';
import { usePersonaTint } from './usePersonaTint';

const TOP = new THREE.Color('#2E1424');
const MID = new THREE.Color('#6E2F52');
const HORIZON = new THREE.Color('#E07A8F');
const DAWN = new THREE.Color('#F4B48C');

const vertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, -0.2, 1.0);
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
    col = mix(col, uTop, smoothstep(0.22, 0.75, h));
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Dawn gradient sky dome. The horizon picks up the persona tint and warms as
 * the journey moves forward. Scene fog is kept equal to the horizon colour so
 * the ground and distant hills melt into the sky.
 */
export function Sky() {
  const tint = usePersonaTint();
  const scene = useThree((s) => s.scene);
  const uniforms = useMemo(
    () => ({
      uTop: { value: TOP.clone() },
      uMid: { value: MID.clone() },
      uHorizon: { value: HORIZON.clone() },
    }),
    [],
  );
  const target = useMemo(() => new THREE.Color(), []);
  const fog = useMemo(() => new THREE.Fog(HORIZON.clone(), 70, 460), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame((_, dt) => {
    const warm = Math.min(1, journey.intro * 0.4 + journey.persona * 0.2 + journey.tunnel * 0.4);
    target
      .copy(HORIZON)
      .lerp(DAWN, warm * 0.55)
      .lerp(tint.current, 0.28);
    const k = 1 - Math.exp(-dt * 2);
    uniforms.uHorizon.value.lerp(target, k);
    fog.color.copy(uniforms.uHorizon.value);
  });

  return (
    <mesh scale={600}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
      />
    </mesh>
  );
}

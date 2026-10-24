import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { stage, type SegmentKind } from '../journeyState';
import { usePersonaTint } from './usePersonaTint';

interface Mood {
  sky: [string, string, string];
  fog: [number, number];
  hemi: [string, string, number];
  sun: [string, number, [number, number, number]];
  ambient: [string, number];
}

/**
 * One mood per kind of segment: the flight at dusk over Asia, the photo spots
 * (the photo covers the sky; the mood only tints the fog and the veil edges)
 * and the Shinkansen at golden hour.
 */
const MOODS: Record<SegmentKind, Mood> = {
  flight: {
    sky: ['#1A0C18', '#3A1A2E', '#7A3A5A'],
    fog: [90, 420],
    hemi: ['#FFE9EF', '#4A2238', 1.15],
    sun: ['#FFE6D2', 1.4, [-8, 30, 10]],
    ambient: ['#F7C6D0', 0.4],
  },
  spot: {
    sky: ['#2E1424', '#4A2238', '#6E2F52'],
    fog: [200, 600],
    hemi: ['#FFD9E2', '#5A2C45', 1],
    sun: ['#FFE6D2', 1.2, [6, 14, 22]],
    ambient: ['#F7C6D0', 0.35],
  },
  train: {
    sky: ['#7A4A6E', '#D98A8A', '#F6C58E'],
    fog: [60, 420],
    hemi: ['#FFE2C8', '#7A4A50', 1.15],
    sun: ['#FFD09A', 2, [-30, 12, 14]],
    ambient: ['#FBE3EA', 0.3],
  },
};

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
 * Sky dome, fog and lights for the active scene. Colours ease within a scene
 * and snap on a scene change (the portal veil hides the cut). Fog always
 * matches the horizon so the ground melts into the sky.
 */
export function Atmosphere() {
  const tint = usePersonaTint();
  const scene = useThree((s) => s.scene);
  const dome = useRef<THREE.Mesh>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);

  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(MOODS.flight.sky[0]) },
      uMid: { value: new THREE.Color(MOODS.flight.sky[1]) },
      uHorizon: { value: new THREE.Color(MOODS.flight.sky[2]) },
    }),
    [],
  );
  const fog = useMemo(() => new THREE.Fog('#E07A8F', 70, 460), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame(({ camera }, dt) => {
    const m = MOODS[stage.kind];
    const k = stage.switched ? 1 : 1 - Math.exp(-dt * 2.5);

    uniforms.uTop.value.lerp(tmp.set(m.sky[0]), k);
    uniforms.uMid.value.lerp(tmp.set(m.sky[1]), k);
    tmp.set(m.sky[2]);
    tmp.lerp(tint.current, 0.2);
    uniforms.uHorizon.value.lerp(tmp, k);
    fog.color.copy(uniforms.uHorizon.value);
    fog.near = THREE.MathUtils.lerp(fog.near, m.fog[0], k);
    fog.far = THREE.MathUtils.lerp(fog.far, m.fog[1], k);

    if (hemi.current) {
      hemi.current.color.lerp(tmp.set(m.hemi[0]), k);
      hemi.current.groundColor.lerp(tmp.set(m.hemi[1]), k);
      hemi.current.intensity = THREE.MathUtils.lerp(hemi.current.intensity, m.hemi[2], k);
    }
    if (sun.current) {
      sun.current.color.lerp(tmp.set(m.sun[0]), k);
      sun.current.intensity = THREE.MathUtils.lerp(sun.current.intensity, m.sun[1], k);
      sun.current.position.set(...m.sun[2]);
    }
    if (ambient.current) {
      ambient.current.color.lerp(tmp.set(m.ambient[0]), k);
      ambient.current.intensity = THREE.MathUtils.lerp(ambient.current.intensity, m.ambient[1], k);
    }
    // Keep the dome centred on the viewer so the gradient never shifts.
    dome.current?.position.copy(camera.position);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#FFD9E2', '#5A2C45', 1.1]} />
      <directionalLight ref={sun} position={[6, 14, 22]} intensity={1.6} color="#FFE6D2" />
      <ambientLight ref={ambient} intensity={0.35} color="#F7C6D0" />
      <mesh ref={dome} scale={600}>
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
    </>
  );
}

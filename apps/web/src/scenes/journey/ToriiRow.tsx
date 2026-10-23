import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../../styles/tokens';
import { FEAR_GATE_Z, REGULAR_GATE_Z } from '../journeyState';
import { usePersonaTint } from './usePersonaTint';

/** Builds the vermilion parts (pillars, beams, strut) and the black kasagi + bases. */
function useGateGeometry() {
  return useMemo(() => {
    const at = (g: THREE.BufferGeometry, x: number, y: number, z = 0) => g.translate(x, y, z);

    const red = mergeGeometries([
      at(new THREE.CylinderGeometry(0.13, 0.15, 3.4, 8), -1.3, 1.7),
      at(new THREE.CylinderGeometry(0.13, 0.15, 3.4, 8), 1.3, 1.7),
      at(new THREE.BoxGeometry(3.3, 0.16, 0.14), 0, 2.72),
      at(new THREE.BoxGeometry(0.2, 0.42, 0.12), 0, 3.05),
      at(new THREE.BoxGeometry(3.6, 0.2, 0.24), 0, 3.32),
    ]);

    // Kasagi: a gently upturned top beam, extruded from a 2D profile.
    const shape = new THREE.Shape();
    shape.moveTo(-2.15, 3.74);
    shape.quadraticCurveTo(0, 3.5, 2.15, 3.74);
    shape.lineTo(2.02, 3.54);
    shape.quadraticCurveTo(0, 3.36, -2.02, 3.54);
    shape.closePath();
    const kasagi = new THREE.ExtrudeGeometry(shape, {
      depth: 0.32,
      bevelEnabled: false,
      curveSegments: 8,
    });
    kasagi.translate(0, 0, -0.16);

    const dark = mergeGeometries([
      kasagi,
      at(new THREE.CylinderGeometry(0.2, 0.22, 0.26, 8), -1.3, 0.13).toNonIndexed(),
      at(new THREE.CylinderGeometry(0.2, 0.22, 0.26, 8), 1.3, 0.13).toNonIndexed(),
    ]);
    return { red, dark };
  }, []);
}

/** Dense senbon-torii row: two draw calls for every regular gate. */
function RegularGates() {
  const { red, dark } = useGateGeometry();
  const redRef = useRef<THREE.InstancedMesh>(null);
  const darkRef = useRef<THREE.InstancedMesh>(null);
  const count = REGULAR_GATE_Z.length;

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    REGULAR_GATE_Z.forEach((z, i) => {
      d.position.set(0, 0, z);
      d.updateMatrix();
      redRef.current?.setMatrixAt(i, d.matrix);
      darkRef.current?.setMatrixAt(i, d.matrix);
    });
    if (redRef.current) redRef.current.instanceMatrix.needsUpdate = true;
    if (darkRef.current) darkRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <instancedMesh ref={redRef} args={[red, undefined, count]}>
        <meshStandardMaterial color={palette.torii} roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={darkRef} args={[dark, undefined, count]}>
        <meshStandardMaterial color="#2A1820" roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}

/**
 * The four fear gates: larger, with a gold plaque and paper lanterns. The
 * nearest one glows as the camera approaches, and a single warm point light
 * follows the camera from gate to gate (cheaper than one light per gate).
 */
function FearGates() {
  const { red, dark } = useGateGeometry();
  const tint = usePersonaTint();
  const redMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lanternMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const glow = useMemo(() => new THREE.Color(palette.gold), []);

  useFrame(({ camera }, dt) => {
    const cz = camera.position.z;
    let nearest = FEAR_GATE_Z[0] ?? 0;
    FEAR_GATE_Z.forEach((z, i) => {
      if (Math.abs(z - cz) < Math.abs(nearest - cz)) nearest = z;
      const near = Math.max(0, 1 - Math.abs(z - cz) / 9);
      const mat = redMats.current[i];
      if (mat) mat.emissiveIntensity = 0.12 + near * 0.6;
      for (const lan of lanternMats.current.slice(i * 2, i * 2 + 2)) {
        if (!lan) continue;
        lan.emissive.copy(glow).lerp(tint.current, 0.25);
        lan.emissiveIntensity = 0.6 + near * 1.4;
      }
    });
    if (light.current) {
      const k = 1 - Math.exp(-dt * 3);
      light.current.position.z += (nearest + 1.2 - light.current.position.z) * k;
    }
  });

  return (
    <>
      <pointLight
        ref={light}
        position={[0, 2.6, FEAR_GATE_Z[0] ?? 0]}
        color={palette.gold}
        intensity={14}
        distance={10}
        decay={1.6}
      />
      {FEAR_GATE_Z.map((z, i) => (
        <group key={z} position={[0, 0, z]} scale={1.22}>
          <mesh geometry={red}>
            <meshStandardMaterial
              ref={(m) => {
                redMats.current[i] = m;
              }}
              color={palette.torii}
              emissive={palette.torii}
              emissiveIntensity={0.12}
              roughness={0.75}
              flatShading
            />
          </mesh>
          <mesh geometry={dark}>
            <meshStandardMaterial color="#2A1820" roughness={0.9} flatShading />
          </mesh>
          {/* Gold plaque on the strut */}
          <mesh position={[0, 3.05, 0.08]}>
            <boxGeometry args={[0.34, 0.5, 0.04]} />
            <meshStandardMaterial
              color={palette.gold}
              emissive={palette.gold}
              emissiveIntensity={0.5}
            />
          </mesh>
          {/* Paper lanterns hanging from the nuki */}
          {[-0.75, 0.75].map((x, j) => (
            <group key={x} position={[x, 2.2, 0]}>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.4, 3]} />
                <meshBasicMaterial color="#2A1820" />
              </mesh>
              <mesh scale={[1, 1.3, 1]}>
                <sphereGeometry args={[0.17, 10, 8]} />
                <meshStandardMaterial
                  ref={(m) => {
                    lanternMats.current[i * 2 + j] = m;
                  }}
                  color="#FBE3C4"
                  emissive={palette.gold}
                  emissiveIntensity={0.8}
                  roughness={1}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

export function ToriiRow() {
  return (
    <group>
      <RegularGates />
      <FearGates />
    </group>
  );
}

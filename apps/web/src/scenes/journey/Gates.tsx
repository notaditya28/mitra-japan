import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette } from '../../styles/tokens';

let cached: { red: THREE.BufferGeometry; dark: THREE.BufferGeometry } | null = null;

/** Myojin torii: vermilion pillars, beams and strut, plus a black upturned kasagi and bases. Built once. */
export function gateGeometry() {
  if (cached) return cached;
  const at = (g: THREE.BufferGeometry, x: number, y: number, z = 0) => g.translate(x, y, z);
  const red = mergeGeometries([
    at(new THREE.CylinderGeometry(0.13, 0.15, 3.4, 8), -1.3, 1.7),
    at(new THREE.CylinderGeometry(0.13, 0.15, 3.4, 8), 1.3, 1.7),
    at(new THREE.BoxGeometry(3.3, 0.16, 0.14), 0, 2.72),
    at(new THREE.BoxGeometry(0.2, 0.42, 0.12), 0, 3.05),
    at(new THREE.BoxGeometry(3.6, 0.2, 0.24), 0, 3.32),
  ]);
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
  cached = { red, dark };
  return cached;
}

const GATE_DARK = '#2A1820';

/** A dense row of identical gates in two draw calls. */
export function GateRow({ zs, scale = 1, x = 0 }: { zs: number[]; scale?: number; x?: number }) {
  const { red, dark } = gateGeometry();
  const redRef = useRef<THREE.InstancedMesh>(null);
  const darkRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const d = new THREE.Object3D();
    zs.forEach((z, i) => {
      d.position.set(x, 0, z);
      d.scale.setScalar(scale);
      d.updateMatrix();
      redRef.current?.setMatrixAt(i, d.matrix);
      darkRef.current?.setMatrixAt(i, d.matrix);
    });
    if (redRef.current) redRef.current.instanceMatrix.needsUpdate = true;
    if (darkRef.current) darkRef.current.instanceMatrix.needsUpdate = true;
  }, [zs, scale, x]);

  return (
    <>
      <instancedMesh ref={redRef} args={[red, undefined, zs.length]}>
        <meshStandardMaterial color={palette.torii} roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={darkRef} args={[dark, undefined, zs.length]}>
        <meshStandardMaterial color={GATE_DARK} roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}

interface GlowGateProps {
  position: [number, number, number];
  scale?: number;
  /** Hanging paper lanterns under the tie beam. */
  lanterns?: boolean;
  /** A soft light disc inside the gate: the portal into the next place. */
  portal?: boolean;
}

/**
 * A feature gate that glows as the camera approaches. Used for fear gates and
 * for the portals between places.
 */
export function GlowGate({
  position,
  scale = 1.22,
  lanterns = true,
  portal = false,
}: GlowGateProps) {
  const { red, dark } = gateGeometry();
  const redMat = useRef<THREE.MeshStandardMaterial>(null);
  const lanternMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const portalMat = useRef<THREE.MeshBasicMaterial>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const group = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!group.current) return;
    group.current.getWorldPosition(world);
    const near = Math.max(0, 1 - camera.position.distanceTo(world) / 12);
    if (redMat.current) redMat.current.emissiveIntensity = 0.12 + near * 0.7;
    for (const m of lanternMats.current) if (m) m.emissiveIntensity = 0.7 + near * 1.5;
    if (portalMat.current) portalMat.current.opacity = 0.18 + near * 0.6;
  });

  return (
    <group ref={group} position={position} scale={scale}>
      <mesh geometry={red}>
        <meshStandardMaterial
          ref={redMat}
          color={palette.torii}
          emissive={palette.torii}
          emissiveIntensity={0.12}
          roughness={0.75}
          flatShading
        />
      </mesh>
      <mesh geometry={dark}>
        <meshStandardMaterial color={GATE_DARK} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 3.05, 0.08]}>
        <boxGeometry args={[0.34, 0.5, 0.04]} />
        <meshStandardMaterial
          color={palette.gold}
          emissive={palette.gold}
          emissiveIntensity={0.6}
        />
      </mesh>
      {lanterns
        ? [-0.75, 0.75].map((lx, j) => (
            <group key={lx} position={[lx, 2.2, 0]}>
              <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.4, 3]} />
                <meshBasicMaterial color={GATE_DARK} />
              </mesh>
              <mesh scale={[1, 1.3, 1]}>
                <sphereGeometry args={[0.17, 10, 8]} />
                <meshStandardMaterial
                  ref={(m) => {
                    lanternMats.current[j] = m;
                  }}
                  color="#FBE3C4"
                  emissive={palette.gold}
                  emissiveIntensity={0.8}
                  roughness={1}
                />
              </mesh>
            </group>
          ))
        : null}
      {portal ? (
        <mesh position={[0, 1.45, -0.05]}>
          <planeGeometry args={[2.4, 2.9]} />
          <meshBasicMaterial
            ref={portalMat}
            color={palette.blush}
            transparent
            opacity={0.2}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

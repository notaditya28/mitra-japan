import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { palette } from '../../../styles/tokens';
import { mapHover } from './mapHover';
import { japan, LAND_HEIGHT, pxToWorld } from './mapSpace';

const TOPS = ['#FBE3EA', '#F7C6D0', '#F9D4DD', '#F4C0CE', '#FAD9E1'];
const SIDE = '#D98FA5';
/** How see-through the selected prefecture gets. */
const SELECTED_OPACITY = 0.38;

interface PrefMesh {
  id: string;
  name: string;
  nameJa: string;
  geometry: THREE.ExtrudeGeometry;
  top: string;
}

/** One extruded, gently bevelled shape per prefecture (47 meshes, built once). */
function usePrefectureMeshes(): PrefMesh[] {
  return useMemo(
    () =>
      japan.prefectures.map((p, i) => {
        const shapes = p.polygons.flatMap((poly) => {
          const [outer, ...holes] = poly;
          if (!outer || outer.length < 4) return [];
          // Shape space is (x, -z) so that after rotating onto the ground, +z is south.
          const toV = (pt: [number, number]) => {
            const [x, z] = pxToWorld(pt);
            return new THREE.Vector2(x, -z);
          };
          const shape = new THREE.Shape(outer.map(toV));
          for (const h of holes) shape.holes.push(new THREE.Path(h.map(toV)));
          return [shape];
        });
        const geometry = new THREE.ExtrudeGeometry(shapes, {
          depth: LAND_HEIGHT,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.03,
          bevelSegments: 1,
          curveSegments: 1,
        });
        geometry.rotateX(-Math.PI / 2);
        return {
          id: p.id,
          name: p.name,
          nameJa: p.nameJa,
          geometry,
          top: TOPS[i % TOPS.length] ?? TOPS[0] ?? '#FBE3EA',
        };
      }),
    [],
  );
}

interface JapanLandProps {
  selectedPrefecture: string | null;
  onHover: (pref: { id: string; name: string; nameJa: string } | null) => void;
  onSelect: (prefId: string) => void;
}

/**
 * Low-poly, matte Japan in blush and petal tones. Hover lifts and tints a prefecture;
 * the selected one turns glassy (see-through with a sakura outline).
 */
export function JapanLand({ selectedPrefecture, onHover, onSelect }: JapanLandProps) {
  const meshes = usePrefectureMeshes();
  const refs = useRef<Record<string, THREE.Mesh | null>>({});
  const hovered = useRef<string | null>(null);
  const highlight = useMemo(() => new THREE.Color(palette.sakura), []);
  const selectedEdges = useMemo(() => {
    const m = meshes.find((x) => x.id === selectedPrefecture);
    return m ? new THREE.EdgesGeometry(m.geometry, 25) : null;
  }, [meshes, selectedPrefecture]);
  useEffect(() => () => selectedEdges?.dispose(), [selectedEdges]);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 10);
    for (const m of meshes) {
      const mesh = refs.current[m.id];
      if (!mesh) continue;
      const active = hovered.current === m.id || selectedPrefecture === m.id;
      // Team guide: hover lifts a prefecture by 0.14 and raises its sakura glow to 0.32.
      mesh.position.y += ((active ? 0.14 : 0) - mesh.position.y) * k;
      const mats = mesh.material as THREE.MeshStandardMaterial[];
      const top = mats[0];
      if (top) top.emissiveIntensity += ((active ? 0.32 : 0) - top.emissiveIntensity) * k;
      const opacity = selectedPrefecture === m.id ? SELECTED_OPACITY : 1;
      for (const mat of mats) {
        mat.opacity += (opacity - mat.opacity) * k;
        // Opaque prefectures keep writing depth; a see-through one must not hide what's below.
        mat.depthWrite = mat.opacity > 0.98;
      }
    }
  });

  const over = (m: PrefMesh) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovered.current = m.id;
    mapHover.prefecture = m.id;
    onHover({ id: m.id, name: m.name, nameJa: m.nameJa });
    document.body.style.cursor = 'pointer';
  };
  const out = (m: PrefMesh) => () => {
    if (hovered.current === m.id) {
      hovered.current = null;
      if (mapHover.prefecture === m.id) mapHover.prefecture = null;
      onHover(null);
      document.body.style.cursor = '';
    }
  };

  return (
    <group>
      {meshes.map((m) => (
        <mesh
          key={m.id}
          ref={(el) => {
            refs.current[m.id] = el;
          }}
          geometry={m.geometry}
          onPointerOver={over(m)}
          onPointerOut={out(m)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(m.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onSelect(m.id);
          }}
        >
          <meshStandardMaterial
            attach="material-0"
            color={m.top}
            emissive={highlight}
            emissiveIntensity={0}
            roughness={0.95}
            transparent
            flatShading
          />
          <meshStandardMaterial
            attach="material-1"
            color={SIDE}
            roughness={1}
            transparent
            flatShading
          />
          {selectedPrefecture === m.id && selectedEdges ? (
            <lineSegments geometry={selectedEdges} raycast={() => null}>
              <lineBasicMaterial color={palette.sakura} transparent opacity={0.9} />
            </lineSegments>
          ) : null}
        </mesh>
      ))}
    </group>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { petalGeometry } from '../../components/motifs/petalGeometry';
import { palette } from '../../styles/tokens';
import { PLACES, stage } from '../journeyState';
import { rng } from './common';

const DEPTH = 6;
const FONT = '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif';

/**
 * Sample points inside a kanji word, in "character units": x spans
 * [-len/2, len/2] and y spans [-0.5, 0.5].
 */
function sampleKanji(text: string, count: number, seed: number): Float32Array {
  const chars = [...text].length;
  const ch = 160;
  const w = ch * chars + 40;
  const h = ch + 40;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const out = new Float32Array(count * 3);
  if (!ctx) return out;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${ch}px ${FONT}`;
  ctx.fillText(text, w / 2, h / 2 + ch * 0.04);
  const data = ctx.getImageData(0, 0, w, h).data;
  const filled: number[] = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) if ((data[(y * w + x) * 4 + 3] ?? 0) > 140) filled.push(x, y);
  }
  const r = rng(seed);
  const n = filled.length / 2;
  for (let i = 0; i < count; i++) {
    const k = n > 0 ? Math.floor(r() * n) : 0;
    const px = filled[k * 2] ?? w / 2;
    const py = filled[k * 2 + 1] ?? h / 2;
    out[i * 3] = ((px - w / 2) / ch) * 1.02;
    out[i * 3 + 1] = -(py - h / 2) / ch;
    out[i * 3 + 2] = (r() - 0.5) * 0.12;
  }
  return out;
}

const veilVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Closing: a soft blush veil fades in. Opening: the veil is cut by a torii
// gate's opening which grows until it fills the screen, with the gate itself
// drawn around the cut so you appear to fly through it.
const veilFragment = /* glsl */ `
  uniform float uCover;
  uniform float uIris;
  uniform float uAspect;
  uniform vec3 uVeil;
  uniform vec3 uVeil2;
  uniform vec3 uRed;
  uniform vec3 uDark;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    vec3 veil = mix(uVeil, uVeil2, clamp(length(p) * 0.9, 0.0, 1.0));

    if (uIris >= 0.999) {
      if (uCover <= 0.001) discard;
      gl_FragColor = vec4(veil, uCover);
      return;
    }

    float s = mix(0.06, 9.0, pow(uIris, 2.2));
    vec2 q = p / s + vec2(0.0, 0.08);
    float ax = abs(q.x);
    float curve = 0.05 * pow(clamp(q.x / 0.62, -1.0, 1.0), 2.0);

    bool hole = ax < 0.36 && q.y < 0.28;
    bool pillar = ax >= 0.36 && ax < 0.43 && q.y < 0.42;
    bool nuki = q.y > 0.28 && q.y < 0.34 && ax < 0.52;
    bool strut = ax < 0.035 && q.y >= 0.34 && q.y < 0.40;
    bool shimaki = q.y >= 0.40 + curve * 0.6 && q.y < 0.45 + curve * 0.6 && ax < 0.54;
    bool kasagi = q.y >= 0.45 + curve && q.y < 0.52 + curve && ax < 0.62;

    if (hole) discard;
    vec3 col = veil;
    if (pillar || nuki || strut || shimaki) col = uRed;
    if (kasagi) col = uDark;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * The signature "petal portal" between places:
 * petals swarm into the next place's kanji while a blush veil closes; after
 * the scene cut the veil opens through a torii-shaped window and the petals
 * burst past the camera. Everything is camera-attached and drawn last.
 */
export function PetalPortal({ count }: { count: number }) {
  const group = useRef<THREE.Group>(null);
  const petals = useRef<THREE.InstancedMesh>(null);
  const veil = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => petalGeometry().scale(1.25, 1.25, 1.25), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [targets, setTargets] = useState<Float32Array[] | null>(null);

  const scatter = useMemo(() => {
    const r = rng(101);
    return Array.from({ length: count }, () => ({
      x: (r() - 0.5) * 22,
      y: (r() - 0.5) * 14,
      z: -2 - r() * 16,
      spin: r() * Math.PI * 2,
      delay: r() * 0.35,
    }));
  }, [count]);

  // Wait for the display font so the petals spell the kanji in Shippori Mincho.
  useEffect(() => {
    let alive = true;
    const text = PLACES.map((p) => p.kanji).join('');
    const build = () => {
      if (alive) setTargets(PLACES.map((p, i) => sampleKanji(p.kanji, count, 300 + i)));
    };
    document.fonts.load(`700 120px "Shippori Mincho"`, text).then(build, build);
    return () => {
      alive = false;
    };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uCover: { value: 0 },
      uIris: { value: 1 },
      uAspect: { value: 1 },
      uVeil: { value: new THREE.Color(palette.paper) },
      uVeil2: { value: new THREE.Color(palette.blush) },
      uRed: { value: new THREE.Color(palette.torii) },
      uDark: { value: new THREE.Color('#2A1820') },
    }),
    [],
  );

  useFrame(({ camera, size, clock }) => {
    const g = group.current;
    if (!g) return;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);

    uniforms.uCover.value = stage.cover;
    uniforms.uIris.value = stage.iris;
    uniforms.uAspect.value = size.width / size.height;
    if (veil.current) veil.current.visible = stage.cover > 0.001 || stage.iris < 0.999;

    const m = petals.current;
    const target = targets && stage.incoming >= 0 ? targets[stage.incoming] : undefined;
    const active = Boolean(target) && (stage.assemble > 0 || stage.burst > 0) && stage.burst < 1;
    if (!m) return;
    m.visible = active;
    if (!active || !target) return;

    const persp = camera as THREE.PerspectiveCamera;
    const viewH = 2 * DEPTH * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
    const viewW = viewH * (size.width / size.height);
    const chars = [...(PLACES[stage.incoming]?.kanji ?? '')].length;
    const unit = Math.min(viewH * 0.3, (viewW * 0.78) / chars);
    const time = clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      const sc = scatter[i];
      if (!sc) continue;
      // Stagger so the word draws itself in rather than snapping.
      const a = Math.min(1, Math.max(0, (stage.assemble - sc.delay) / (1 - sc.delay)));
      const e = a * a * (3 - 2 * a);
      const tx = (target[i * 3] ?? 0) * unit;
      const ty = (target[i * 3 + 1] ?? 0) * unit;
      const tz = -DEPTH + (target[i * 3 + 2] ?? 0) * unit;
      let x = THREE.MathUtils.lerp(sc.x, tx, e);
      let y = THREE.MathUtils.lerp(sc.y, ty, e);
      let z = THREE.MathUtils.lerp(sc.z, tz, e);
      if (stage.burst > 0) {
        const b = stage.burst;
        const len = Math.hypot(tx, ty) || 1;
        x += (tx / len) * b * 9;
        y += (ty / len) * b * 6;
        z += b * 7;
      }
      dummy.position.set(x, y, z);
      // Tumble while flying, settle flat (readable) once assembled.
      const tumble = 1 - e + stage.burst;
      dummy.rotation.set(
        Math.sin(time * 2 + sc.spin) * tumble * 1.4,
        Math.cos(time * 1.6 + sc.spin) * tumble * 1.4,
        sc.spin,
      );
      dummy.scale.setScalar(0.9 * (1 - stage.burst * 0.6));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <mesh ref={veil} frustumCulled={false} renderOrder={998} visible={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={veilVertex}
          fragmentShader={veilFragment}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh
        ref={petals}
        args={[geometry, undefined, count]}
        frustumCulled={false}
        renderOrder={999}
        visible={false}
      >
        {/* Transparent so it sorts after the veil (renderOrder only orders within a pass). */}
        <meshBasicMaterial
          color={palette.rose}
          side={THREE.DoubleSide}
          transparent
          depthTest={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  COUNTRIES,
  DESTINATION,
  MAP_H,
  MAP_W,
  ORIGIN,
  path,
  project,
  routeLngLat,
} from '../../features/tour/flightMap';
import { FROM, TOUR_CITIES } from '../../features/tour/tour';
import { palette } from '../../styles/tokens';
import { journey, stage } from '../journeyState';
import { localT, smooth, useSceneGroup, type CameraPath } from './common';

/** World size of the map plane; north is -z. */
const WORLD_W = 80;
const WORLD_H = (WORLD_W * MAP_H) / MAP_W;
const ARC = 4.2;
const SEGMENTS = 160;

const toWorld = (lng: number, lat: number): [number, number] => {
  const [px, py] = project(lng, lat);
  return [(px / MAP_W - 0.5) * WORLD_W, (py / MAP_H - 0.5) * WORLD_H];
};

/** The flight path, lifted into an arc above the map. */
const CURVE = new THREE.CatmullRomCurve3(
  routeLngLat(80).map(([lng, lat], i, all) => {
    const [x, z] = toWorld(lng, lat);
    const s = i / (all.length - 1);
    return new THREE.Vector3(x, 0.35 + Math.sin(Math.PI * s) * ARC, z);
  }),
);
const START = toWorld(...ORIGIN);
const END = toWorld(...DESTINATION);

/** Route progress for local t: wait at Delhi while the scroll starts, land just before the portal. */
const flown = (t: number) => smooth(0.05, 0.86, t);

const SEA = '#2A1222';
const FONT_DISPLAY = '"Shippori Mincho", "Yu Mincho", serif';
const FONT_UI = '"Plus Jakarta Sans", system-ui, sans-serif';

/** The map drawn once to a canvas: dark sea, muted neighbours, India in gold, Japan in sakura. */
function drawMap(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = SEA;
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Faint graticule.
  ctx.strokeStyle = 'rgba(247,198,208,0.06)';
  ctx.lineWidth = 2;
  for (let lng = 60; lng <= 150; lng += 10) {
    const [x] = project(lng, 0);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, MAP_H);
    ctx.stroke();
  }
  for (let lat = 0; lat <= 50; lat += 10) {
    const [, y] = project(100, lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(MAP_W, y);
    ctx.stroke();
  }

  const draw = path.context(ctx);
  for (const c of COUNTRIES) {
    ctx.beginPath();
    draw(c.geometry);
    ctx.fillStyle = c.id === 'IND' ? '#E9B872' : c.id === 'JPN' ? '#F4B6C6' : '#6E3A56';
    ctx.fill();
    ctx.strokeStyle = c.id === 'IND' || c.id === 'JPN' ? '#FFF8FA' : '#8E5C74';
    ctx.lineWidth = c.id === 'IND' || c.id === 'JPN' ? 2.5 : 1.5;
    ctx.stroke();
  }
  path.context(null);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(74,34,56,0.7)';
  const [ix, iy] = project(79, 22);
  ctx.font = `600 64px ${FONT_DISPLAY}`;
  ctx.fillText('भारत', ix, iy);
  ctx.font = `700 26px ${FONT_UI}`;
  ctx.fillText('INDIA', ix, iy + 40);
  // Fade every edge into the open sea so the map has no hard border.
  const fade = 220;
  const edges: [number, number, number, number, number, number, number, number][] = [
    [0, 0, 0, fade, 0, 0, MAP_W, fade],
    [0, MAP_H, 0, MAP_H - fade, 0, MAP_H - fade, MAP_W, fade],
    [0, 0, fade, 0, 0, 0, fade, MAP_H],
    [MAP_W, 0, MAP_W - fade, 0, MAP_W - fade, 0, fade, MAP_H],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, SEA);
    g.addColorStop(1, 'rgba(42,18,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }

  // Japan is seen from the plane heading east, so its label faces that way.
  const [jx, jy] = project(137.5, 41);
  ctx.save();
  ctx.translate(jx, jy);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(255,248,250,0.75)';
  ctx.font = `600 52px ${FONT_DISPLAY}`;
  ctx.fillText('日本', 0, 0);
  ctx.font = `700 22px ${FONT_UI}`;
  ctx.fillText('JAPAN', 0, 32);
  ctx.restore();
}

function MapPlane() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = MAP_W;
    canvas.height = MAP_H;
    drawMap(canvas);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);

  // Labels drawn before the fonts arrived get redrawn once they have.
  useEffect(() => {
    let alive = true;
    void document.fonts.ready.then(() => {
      if (!alive) return;
      drawMap(texture.image as HTMLCanvasElement);
      texture.needsUpdate = true;
    });
    return () => {
      alive = false;
      texture.dispose();
    };
  }, [texture]);

  return (
    <>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[WORLD_W, WORLD_H]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
      {/* Open sea beyond the map's edges, so the camera never sees past them. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
        <planeGeometry args={[WORLD_W * 8, WORLD_H * 8]} />
        <meshStandardMaterial color={SEA} roughness={1} />
      </mesh>
    </>
  );
}

/** Solid gold for the part already flown, a faint dashed line for the rest. */
function Route() {
  const tube = useMemo(() => new THREE.TubeGeometry(CURVE, SEGMENTS, 0.07, 6, false), []);
  const dashed = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(CURVE.getPoints(SEGMENTS));
    const line = new THREE.Line(
      g,
      new THREE.LineDashedMaterial({
        color: palette.petal,
        dashSize: 0.45,
        gapSize: 0.35,
        transparent: true,
        opacity: 0.55,
      }),
    );
    line.computeLineDistances();
    return line;
  }, []);

  useFrame(() => {
    const done = Math.floor(flown(localT('flight')) * SEGMENTS);
    // Each tubular segment is radialSegments × 6 indices.
    tube.setDrawRange(0, done * 6 * 6);
  });

  return (
    <group>
      <primitive object={dashed} />
      <mesh geometry={tube}>
        <meshBasicMaterial color={palette.gold} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Low-poly airliner, nose towards +z (Object3D.lookAt aims +z at the target). */
function Plane() {
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const s = flown(localT('flight'));
    CURVE.getPointAt(Math.min(s, 0.999), pos);
    CURVE.getPointAt(Math.min(s + 0.01, 1), ahead);
    // A little bob so it feels airborne, none while parked at Delhi.
    pos.y += Math.sin(clock.elapsedTime * 1.6) * 0.05 * Math.min(1, s * 20);
    g.position.copy(pos);
    g.lookAt(ahead);
    g.rotateZ(Math.sin(clock.elapsedTime * 0.8) * 0.05);
    if (shadow.current) {
      shadow.current.position.set(pos.x, 0.02, pos.z);
      const k = 1 - (pos.y / (ARC + 1)) * 0.6;
      shadow.current.scale.setScalar(k);
    }
  });

  return (
    <>
      <group ref={group} scale={0.38}>
        <mesh rotation-x={Math.PI / 2}>
          <capsuleGeometry args={[0.32, 2.6, 4, 10]} />
          <meshStandardMaterial color={palette.paper} roughness={0.5} flatShading />
        </mesh>
        <mesh position={[0, -0.05, 0.1]}>
          <boxGeometry args={[3.6, 0.08, 0.7]} />
          <meshStandardMaterial color={palette.rose} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, 0.05, -1.45]}>
          <boxGeometry args={[1.4, 0.06, 0.4]} />
          <meshStandardMaterial color={palette.rose} roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0, 0.45, -1.5]} rotation-x={-0.35}>
          <boxGeometry args={[0.07, 0.8, 0.55]} />
          <meshStandardMaterial color={palette.gold} roughness={0.6} flatShading />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.95, -0.25, 0.3]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.13, 0.13, 0.55, 8]} />
            <meshStandardMaterial color="#C7AEB8" roughness={0.6} flatShading />
          </mesh>
        ))}
      </group>
      <mesh ref={shadow} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.7, 20]} />
        <meshBasicMaterial color="#12060E" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </>
  );
}

function Pin({
  at,
  color,
  label,
  sub,
  lang,
}: {
  at: [number, number];
  color: string;
  label: string;
  sub: string;
  lang: string;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const tag = useRef<HTMLDivElement>(null);
  useFrame(({ clock }) => {
    // HTML labels sit above the canvas, so hide them while the portal veil is up.
    if (tag.current)
      tag.current.style.opacity = stage.cover > 0.02 || stage.iris < 0.98 ? '0' : '1';
    const r = ring.current;
    if (!r) return;
    const k = (clock.elapsedTime * 0.6) % 1;
    r.scale.setScalar(0.6 + k * 1.6);
    (r.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
  });
  return (
    <group position={[at[0], 0.04, at[1]]}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.28, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.45, 0.6, 32]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <Html position={[0, 1.1, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={tag}
          className="whitespace-nowrap rounded-full bg-plum/85 px-3 py-1 text-center text-xs font-semibold text-paper shadow-lift"
        >
          <span lang={lang} className="mr-1.5 font-display text-sm">
            {label}
          </span>
          {sub}
        </div>
      </Html>
    </group>
  );
}

/** Delhi → the first city: the map of Asia, the route and the plane. */
export function FlightScene() {
  const group = useSceneGroup('flight');
  const first = TOUR_CITIES[0];
  return (
    <group ref={group}>
      <MapPlane />
      <Route />
      <Plane />
      <Pin at={START} color={palette.gold} label={FROM.nameLocal} sub={FROM.name} lang="hi" />
      {first ? (
        <Pin at={END} color={palette.sakura} label={first.nameJa} sub={first.name} lang="ja" />
      ) : null}
    </group>
  );
}

const planePos = new THREE.Vector3();
const planeAhead = new THREE.Vector3();
const wide = new THREE.Vector3();
const wideLook = new THREE.Vector3();
const chase = new THREE.Vector3();
const chaseLook = new THREE.Vector3();

/**
 * Wide over India while the traveller picker is up, then a chase camera behind
 * the plane, then a dive towards the first city as the portal opens.
 */
export const flightCamera: CameraPath = (t, pos, look) => {
  const s = flown(t);
  CURVE.getPointAt(Math.min(s, 0.999), planePos);
  CURVE.getPointAt(Math.min(s + 0.04, 1), planeAhead);

  // Opening view: India in the lower left, Japan visible far right.
  const intro = 1 - journey.intro;
  wide.set(START[0] + 11, 30 + intro * 8, START[1] + 22);
  wideLook.set(START[0] + 13, 0, START[1] - 13);

  const dir = planeAhead.clone().sub(planePos).setY(0).normalize();
  chase
    .copy(planePos)
    .addScaledVector(dir, -11)
    .add(new THREE.Vector3(0, 7, 0));
  chaseLook.copy(planePos).addScaledVector(dir, 9);
  chaseLook.y = 0;

  const toChase = smooth(0.02, 0.2, t);
  pos.lerpVectors(wide, chase, toChase);
  look.lerpVectors(wideLook, chaseLook, toChase);

  // Dive towards the destination as the plane lands, still facing east.
  const dive = smooth(0.8, 1, t);
  pos.lerp(new THREE.Vector3(END[0] - 4, 2.4, END[1] + 0.5), dive);
  look.lerp(new THREE.Vector3(END[0] + 2, 0, END[1] - 0.3), dive);
};

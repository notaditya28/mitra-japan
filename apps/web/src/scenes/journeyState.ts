import { LAYOUT, SEGMENTS, type PlaceScene, type Segment } from '../features/tour/tour';

/**
 * Shared, mutable scroll state for the Stage 1 journey. HTML ScrollTriggers
 * write it; the R3F scene reads it every frame. Deliberately not React state
 * so scrolling never re-renders the tree.
 */
export const journey = {
  /** 0 → 1 intro on load (the map fades up). */
  intro: 0,
  /** Tour section scroll progress, 0 → 1 across the flight, every spot and every train. */
  tour: 0,
  /** Pointer position in -1..1 for gentle parallax. */
  pointer: { x: 0, y: 0 },
};

export type SegmentKind = Segment['kind'];
/** What the canvas shows: the flight, the train, or a spot's 3D scene. */
export type ViewId = 'flight' | 'train' | PlaceScene;

export const viewOf = (s: Segment | undefined): ViewId =>
  !s ? 'flight' : s.kind === 'spot' ? s.spot.scene : s.kind;

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * Derived every frame by the CameraRig from `journey`.
 *
 * Every segment boundary is the same slow dip to deep plum, in weight units
 * (one spot = 1.4; d = signed distance to the boundary, negative = before the cut):
 *   -0.20 … -0.03  the scene fades down into plum, the FOV widens slightly
 *   -0.03 …  0.03  fully dark; the scene, sky and camera switch at 0
 *    0.03 …  0.20  the next scene fades up out of the dark
 */
export const stage = {
  /** Index into SEGMENTS of the segment on screen. */
  scene: 0,
  kind: (SEGMENTS[0]?.kind ?? 'flight') as SegmentKind,
  /** Scene on screen; decides which group, camera and sky are used. */
  view: viewOf(SEGMENTS[0]),
  /** Local progress inside the active segment, 0..1. */
  t: 0,
  /** Index into SEGMENTS of the segment being transitioned into, or -1. */
  incoming: -1,
  /** Fade opacity, 0..1. */
  cover: 0,
  /** Extra field of view for a gentle push, degrees. */
  warp: 0,
  /** True on the frame the scene changed, so the camera can snap. */
  switched: false,
};

const BEFORE = 0.2;
const AFTER = 0.2;
const HOLD = 0.03;
const WARP = 4;

function applyBoundary(out: typeof stage, d: number, incoming: number) {
  out.incoming = incoming;
  if (d < 0) {
    out.cover = smooth(-BEFORE, -HOLD, d);
    out.warp = WARP * smooth(-BEFORE, 0, d);
  } else {
    out.cover = 1 - smooth(HOLD, AFTER, d);
    out.warp = WARP * (1 - smooth(0, AFTER, d));
  }
}

function clearBoundary(out: typeof stage) {
  out.incoming = -1;
  out.cover = 0;
  out.warp = 0;
}

/** Segment index and local t for a position in weight units. */
export function locate(pos: number, starts: number[], total: number): { index: number; t: number } {
  const n = starts.length;
  if (n === 0) return { index: 0, t: 0 };
  const p = Math.min(Math.max(pos, 0), total - 1e-6);
  let index = 0;
  while (index + 1 < n && (starts[index + 1] ?? Infinity) <= p) index++;
  const start = starts[index] ?? 0;
  const end = starts[index + 1] ?? total;
  return { index, t: (p - start) / (end - start) };
}

export function computeStage(
  out = stage,
  progress = journey.tour,
  segments: Segment[] = SEGMENTS,
  { starts, total } = LAYOUT,
): typeof stage {
  const prev = out.scene;
  const pos = progress * total;
  const { index, t } = locate(pos, starts, total);
  out.scene = index;
  out.kind = segments[index]?.kind ?? 'flight';
  out.view = viewOf(segments[index]);
  out.t = t;

  // Nearest boundary (the start of segment k, k ≥ 1).
  let k = -1;
  let d = Infinity;
  for (let i = 1; i < starts.length; i++) {
    const di = pos - (starts[i] ?? 0);
    if (Math.abs(di) < Math.abs(d)) {
      d = di;
      k = i;
    }
  }
  if (k > 0 && d > -BEFORE && d < AFTER) applyBoundary(out, d, k);
  else clearBoundary(out);

  out.switched = out.scene !== prev;
  return out;
}

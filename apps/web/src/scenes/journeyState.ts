import { LAYOUT, SEGMENTS, isPlainBoundary, type Segment } from '../features/tour/tour';

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

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * Derived every frame by the CameraRig from `journey`.
 *
 * Transitions sit around each segment boundary, in weight units (one spot = 1;
 * d = signed distance to the boundary, negative = before the cut):
 *   Petal portal (arriving in a city, boarding or leaving the train):
 *     -0.13 … -0.03  petals swarm into the next place's kanji, FOV widens
 *     -0.07 … -0.01  blush veil closes over the scene
 *      0             scene switches under the veil
 *      0    …  0.09  veil opens through a torii-shaped window, petals burst away
 *   Plain (between spots in one city): the same veil and torii window, no petals.
 */
export const stage = {
  /** Index into SEGMENTS of the segment on screen. */
  scene: 0,
  kind: (SEGMENTS[0]?.kind ?? 'flight') as SegmentKind,
  /** Local progress inside the active segment, 0..1. */
  t: 0,
  /** Index into SEGMENTS of the segment being transitioned into, or -1. */
  incoming: -1,
  /** True when the current transition shows no petals (moving between spots in a city). */
  plain: false,
  /** Petals gathering into the kanji, 0..1. */
  assemble: 0,
  /** Petals bursting outward after the cut, 0..1. */
  burst: 0,
  /** Veil opacity while closing, 0..1. */
  cover: 0,
  /** Torii window opening after the cut, 0 (closed) .. 1 (fully open). */
  iris: 1,
  /** Extra field of view for the speed warp, degrees. */
  warp: 0,
  /** True on the frame the scene changed, so the camera can snap. */
  switched: false,
};

const BEFORE = 0.13;
const AFTER = 0.09;

function applyBoundary(out: typeof stage, d: number, incoming: number, plain: boolean) {
  out.incoming = incoming;
  out.plain = plain;
  const warp = plain ? 5 : 16;
  if (d < 0) {
    out.assemble = plain ? 0 : smooth(-BEFORE, -0.03, d);
    out.cover = smooth(-0.07, -0.01, d);
    out.iris = 1;
    out.burst = 0;
    out.warp = warp * smooth(-BEFORE, 0, d);
  } else {
    out.assemble = plain ? 0 : 1;
    out.cover = 0;
    out.iris = smooth(0.004, AFTER, d);
    out.burst = plain ? 0 : smooth(0, 0.065, d);
    out.warp = warp * (1 - smooth(0, AFTER, d));
  }
}

function clearBoundary(out: typeof stage) {
  out.incoming = -1;
  out.plain = false;
  out.assemble = 0;
  out.burst = 0;
  out.cover = 0;
  out.iris = 1;
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
  if (k > 0 && d > -BEFORE && d < AFTER) applyBoundary(out, d, k, isPlainBoundary(segments, k));
  else clearBoundary(out);

  out.switched = out.scene !== prev;
  return out;
}

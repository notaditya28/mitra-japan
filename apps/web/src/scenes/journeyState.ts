/**
 * Shared, mutable scroll state for the Stage 1 journey. HTML ScrollTriggers
 * write it; the R3F scene reads it every frame. Deliberately not React state
 * so scrolling never re-renders the tree.
 */
export const journey = {
  /** 0 → 1 dawn intro on load (sun rise). */
  intro: 0,
  /** Hero section scroll progress. */
  hero: 0,
  /** Persona section scroll progress. */
  persona: 0,
  /** Places section scroll progress, 0 → 1 across all places. */
  places: 0,
  /** Pointer position in -1..1 for gentle parallax. */
  pointer: { x: 0, y: 0 },
};

export const FEAR_IDS = ['food', 'language', 'visa', 'foreign'] as const;
export type FearId = (typeof FEAR_IDS)[number];

/** The places the journey travels through after Fuji, in order, each answering one fear. */
export const PLACES = [
  { id: 'tokyo', fear: 'food', kanji: '東京' },
  { id: 'shinkansen', fear: 'language', kanji: '新幹線' },
  { id: 'kyoto', fear: 'visa', kanji: '京都' },
  { id: 'matsuri', fear: 'foreign', kanji: '祭り' },
] as const satisfies readonly { id: string; fear: FearId; kanji: string }[];
export type PlaceId = (typeof PLACES)[number]['id'];

/** Scene indices: 0 is Fuji (hero + persona), then one per place. */
export const SCENE_COUNT = PLACES.length + 1;

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * Derived every frame by the Director from `journey`.
 *
 * The "petal portal" transition around each boundary, in chapter units
 * (d = signed distance to the boundary, negative = before the cut):
 *   -0.13 … -0.03  petals swarm into the next place's kanji, FOV widens
 *   -0.07 … -0.01  blush veil closes over the scene
 *    0             scene switches under the veil
 *    0    …  0.09  veil opens through a torii-shaped window, petals burst away
 */
export const stage = {
  scene: 0,
  /** Local progress inside the active scene, 0..1. */
  t: 0,
  /** Index into PLACES of the place being transitioned into, or -1. */
  incoming: -1,
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

function applyBoundary(out: typeof stage, d: number, incoming: number) {
  out.incoming = incoming;
  if (d < 0) {
    out.assemble = smooth(-BEFORE, -0.03, d);
    out.cover = smooth(-0.07, -0.01, d);
    out.iris = 1;
    out.burst = 0;
    out.warp = 16 * smooth(-BEFORE, 0, d);
  } else {
    out.assemble = 1;
    out.cover = 0;
    out.iris = smooth(0.004, AFTER, d);
    out.burst = smooth(0, 0.065, d);
    out.warp = 16 * (1 - smooth(0, AFTER, d));
  }
}

function clearBoundary(out: typeof stage) {
  out.incoming = -1;
  out.assemble = 0;
  out.burst = 0;
  out.cover = 0;
  out.iris = 1;
  out.warp = 0;
}

export function computeStage(out = stage): typeof stage {
  const prev = out.scene;
  if (journey.places > 0) {
    const p = journey.places * PLACES.length;
    const i = Math.min(PLACES.length - 1, Math.floor(p));
    out.scene = i + 1;
    out.t = p - i;
    const k = Math.round(p);
    const d = p - k;
    // Boundaries 0..3 bring in PLACES[k]; the end of the last place has no portal.
    if (k < PLACES.length && d > -BEFORE && d < AFTER) applyBoundary(out, d, k);
    else clearBoundary(out);
  } else {
    out.scene = 0;
    out.t = journey.persona;
    // The dive from Fuji into Tokyo happens over the last part of the persona section.
    const d = (journey.persona - 1) * 0.65;
    if (d > -BEFORE) applyBoundary(out, d, 0);
    else clearBoundary(out);
  }
  out.switched = out.scene !== prev;
  return out;
}

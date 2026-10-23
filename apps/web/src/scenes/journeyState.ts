/**
 * Shared, mutable scroll state for the Stage 1 journey. HTML ScrollTriggers
 * write it; the R3F camera rig reads it every frame. Deliberately not React
 * state so scrolling never re-renders the tree.
 */
export const journey = {
  /** 0 → 1 dawn intro on load (sun rise). */
  intro: 0,
  /** Hero section scroll progress. */
  hero: 0,
  /** Persona section scroll progress. */
  persona: 0,
  /** Torii tunnel scroll progress. */
  tunnel: 0,
  /** Pointer position in -1..1 for gentle parallax. */
  pointer: { x: 0, y: 0 },
};

export const FEAR_IDS = ['food', 'language', 'visa', 'foreign'] as const;
export type FearId = (typeof FEAR_IDS)[number];

/** Camera z where the tunnel starts and ends. */
export const TUNNEL_START_Z = 9;
export const TUNNEL_END_Z = -50;

/**
 * Fear gates sit where the camera passes them at the middle of each card's
 * scroll segment, so the card flips exactly as you walk through the gate.
 */
export const FEAR_GATE_Z = FEAR_IDS.map(
  (_, i) => TUNNEL_START_Z + (TUNNEL_END_Z - TUNNEL_START_Z) * ((i + 0.5) / FEAR_IDS.length),
);

/** Regular senbon-torii gates every GATE_SPACING units, leaving room around fear gates. */
export const GATE_SPACING = 1.9;
export const REGULAR_GATE_Z: number[] = (() => {
  const out: number[] = [];
  for (let z = 4; z > TUNNEL_END_Z + 2; z -= GATE_SPACING) {
    if (FEAR_GATE_Z.every((f) => Math.abs(f - z) > 1.2)) out.push(z);
  }
  return out;
})();

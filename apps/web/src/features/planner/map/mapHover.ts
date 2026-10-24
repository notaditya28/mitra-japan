/**
 * What the pointer is over on the planner map. Mutable on purpose: it changes every few
 * frames and is read inside useFrame, so it never goes through React state.
 */
export const mapHover: {
  /** Prefecture under the pointer. */
  prefecture: string | null;
  /** City whose label the pointer (or keyboard focus) is on. */
  label: string | null;
} = { prefecture: null, label: null };

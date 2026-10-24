import { create } from 'zustand';

/**
 * Which tour segment is on screen, for the chapter rail and the city map window.
 * The 3D journey writes it from the shared stage (only when it changes); the static
 * layout writes it from whichever city section is in view. Not persisted.
 */
export const useTourStore = create<{ segment: number; setSegment: (i: number) => void }>((set) => ({
  segment: 0,
  setSegment: (segment) => set((s) => (s.segment === segment ? s : { segment })),
}));

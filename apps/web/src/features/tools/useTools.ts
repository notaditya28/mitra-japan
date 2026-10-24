import { create } from 'zustand';

export type Tool = 'trips' | 'scan' | 'eat' | 'visa' | 'book' | 'schedule';

interface ToolsState {
  tool: Tool | null;
  /** City filter to start the restaurant directory with. */
  eatCity: string | null;
  open: (tool: Tool, opts?: { city?: string | null }) => void;
  close: () => void;
}

/** Which planner tool dialog is open. Not persisted. */
export const useTools = create<ToolsState>()((set) => ({
  tool: null,
  eatCity: null,
  open: (tool, opts = {}) => set({ tool, eatCity: opts.city ?? null }),
  close: () => set({ tool: null }),
}));

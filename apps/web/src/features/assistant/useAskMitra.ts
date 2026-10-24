import { create } from 'zustand';

/**
 * Whether the Ask Mitra pop-up is open, plus an optional question to prefill
 * (e.g. "Ask Mitra about Nagano" from a prefecture card). Not persisted; the chat
 * itself lives in `useAssistantStore`.
 */
export const useAskMitra = create<{
  open: boolean;
  draft: string | null;
  setOpen: (open: boolean) => void;
  ask: (question: string) => void;
  takeDraft: () => void;
}>()((set) => ({
  open: false,
  draft: null,
  setOpen: (open) => set({ open }),
  ask: (question) => set({ open: true, draft: question }),
  takeDraft: () => set({ draft: null }),
}));

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { useAppStore } from '../../store/useAppStore';
import type { Itinerary } from '../planner/itinerary';
import { usePlannerStore } from '../planner/usePlannerStore';
import {
  applyPatch as apiApply,
  chat as apiChat,
  deleteServerTripData,
  undo as apiUndo,
} from './assistantApi';
import type { AssistantResponse, ProposedPatch } from './types';

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
}
export interface AssistantMessage {
  id: string;
  role: 'assistant';
  response: AssistantResponse;
  /** Diff-card state for plan changes. */
  patchState?: 'proposed' | 'applying' | 'applied' | 'dismissed' | 'failed' | 'undone';
  patchError?: string;
}
export interface LocalMessage {
  id: string;
  role: 'local';
  kind: 'nearby' | 'emergency' | 'error' | 'info';
  text: string;
  data?: unknown;
}
export type ChatMessage = UserMessage | AssistantMessage | LocalMessage;

interface UndoEntry {
  token: string | null;
  previous: Itinerary;
  summary: string;
  messageId: string;
}

interface AssistantState {
  sessionId: string;
  messages: ChatMessage[];
  /** "cityId|stop name" keys the traveller locked. */
  pinned: string[];
  /** Which itinerary day it is during the trip (null before the trip). */
  currentDay: number | null;
  /** Session-only, never persisted or sent to the server. */
  location: { lat: number; lng: number } | null;
  sending: boolean;
  undo: UndoEntry | null;
  /** Days touched by the last applied change, for a brief highlight. */
  changedDays: number[];
  send: (text: string) => Promise<void>;
  addLocal: (m: Omit<LocalMessage, 'id' | 'role'>) => void;
  togglePin: (cityId: string, name: string) => void;
  setCurrentDay: (d: number | null) => void;
  setLocation: (loc: { lat: number; lng: number } | null) => void;
  applyProposal: (messageId: string) => Promise<void>;
  dismissProposal: (messageId: string) => void;
  undoLast: () => Promise<void>;
  clearUndo: () => void;
  deleteAll: () => Promise<{ server: boolean }>;
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const MAX_MESSAGES = 40;

/** What the API is told about the trip. Built fresh for every request from what's on screen. */
export function buildTripContext(sessionId: string, pinned: string[], currentDay: number | null) {
  const { diet, persona, language } = useAppStore.getState();
  const itinerary = usePlannerStore.getState().itinerary;
  return {
    session_id: sessionId,
    language,
    diet:
      diet === 'none'
        ? null
        : { value: { diet, custom: [] }, provenance: 'user-provided', note: 'From your profile' },
    travel_style: persona
      ? { value: persona, provenance: 'user-provided', note: 'Persona chosen in the app' }
      : null,
    itinerary,
    pinned,
    current_day: itinerary && currentDay && currentDay <= itinerary.days.length ? currentDay : null,
  };
}

function history(messages: ChatMessage[]) {
  return messages
    .filter((m): m is UserMessage | AssistantMessage => m.role !== 'local')
    .slice(-6)
    .map((m) => ({
      role: m.role,
      text: (m.role === 'user' ? m.text : m.response.answer).slice(0, 2000),
    }));
}

const guarded: StateStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* storage full or blocked: the chat still works for this tab */
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      sessionId: newId(),
      messages: [],
      pinned: [],
      currentDay: null,
      location: null,
      sending: false,
      undo: null,
      changedDays: [],

      async send(text) {
        const message = text.trim().slice(0, 1000);
        if (!message || get().sending) return;
        const userMsg: UserMessage = { id: newId(), role: 'user', text: message };
        set((s) => ({ messages: [...s.messages, userMsg].slice(-MAX_MESSAGES), sending: true }));
        const { sessionId, pinned, currentDay } = get();
        const r = await apiChat({
          message,
          session_id: sessionId,
          trip_context: buildTripContext(sessionId, pinned, currentDay),
          language: useAppStore.getState().language,
          history: history(get().messages.slice(0, -1)),
        });
        if (!r.ok) {
          set((s) => ({
            sending: false,
            messages: [
              ...s.messages,
              { id: newId(), role: 'local' as const, kind: 'error' as const, text: r.error.code },
            ].slice(-MAX_MESSAGES),
          }));
          return;
        }
        const resp = r.value;
        // Preference changes the assistant picked up (e.g. "we eat Jain now") update the profile.
        const newDiet = resp.trip_context?.diet?.value?.diet;
        const app = useAppStore.getState();
        if (
          newDiet &&
          newDiet !== app.diet &&
          ['jain', 'vegetarian', 'vegan', 'halal', 'no-beef', 'eggless'].includes(newDiet)
        ) {
          app.setDiet(newDiet as typeof app.diet);
        }
        const msg: AssistantMessage = {
          id: newId(),
          role: 'assistant',
          response: { ...resp, trip_context: null },
          patchState: resp.proposed_patch ? 'proposed' : undefined,
        };
        set((s) => ({ sending: false, messages: [...s.messages, msg].slice(-MAX_MESSAGES) }));
      },

      addLocal(m) {
        set((s) => ({
          messages: [...s.messages, { ...m, id: newId(), role: 'local' as const }].slice(
            -MAX_MESSAGES,
          ),
        }));
      },

      togglePin(cityId, name) {
        const key = `${cityId}|${name}`;
        set((s) => ({
          pinned: s.pinned.includes(key)
            ? s.pinned.filter((k) => k !== key)
            : [...s.pinned, key].slice(-60),
        }));
      },

      setCurrentDay: (currentDay) => set({ currentDay }),
      setLocation: (location) => set({ location }),

      async applyProposal(messageId) {
        const msg = get().messages.find(
          (m): m is AssistantMessage => m.id === messageId && m.role === 'assistant',
        );
        const proposal: ProposedPatch | null | undefined = msg?.response.proposed_patch;
        const previous = usePlannerStore.getState().itinerary;
        if (!msg || !proposal || !previous) return;
        const mark = (patchState: AssistantMessage['patchState'], patchError?: string) =>
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === messageId ? { ...(m as AssistantMessage), patchState, patchError } : m,
            ),
          }));
        mark('applying');
        const r = await apiApply({
          session_id: get().sessionId,
          itinerary: previous,
          patch: proposal.patch,
          pinned: get().pinned,
        });
        if (!r.ok) {
          mark('failed', r.error.code);
          return;
        }
        usePlannerStore.getState().replaceItinerary(r.value.itinerary);
        const changed = (r.value.diff?.days ?? [])
          .filter((d) => d.status === 'changed' || d.status === 'added')
          .map((d) => d.day);
        mark('applied');
        set({
          undo: { token: r.value.undo_token, previous, summary: proposal.patch.summary, messageId },
          changedDays: changed,
        });
        window.setTimeout(() => set({ changedDays: [] }), 2600);
      },

      dismissProposal(messageId) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId
              ? { ...(m as AssistantMessage), patchState: 'dismissed' as const }
              : m,
          ),
        }));
      },

      async undoLast() {
        const u = get().undo;
        if (!u) return;
        // Ask the server (keeps its copy in sync); if it's unreachable the browser's copy is enough.
        const r = u.token ? await apiUndo(get().sessionId, u.token) : null;
        usePlannerStore.getState().replaceItinerary(r && r.ok ? r.value : u.previous);
        set((s) => ({
          undo: null,
          messages: s.messages.map((m) =>
            m.id === u.messageId
              ? { ...(m as AssistantMessage), patchState: 'undone' as const }
              : m,
          ),
        }));
      },

      clearUndo: () => set({ undo: null }),

      async deleteAll() {
        const sessionId = get().sessionId;
        const r = await deleteServerTripData(sessionId);
        set({
          sessionId: newId(),
          messages: [],
          pinned: [],
          currentDay: null,
          location: null,
          undo: null,
        });
        return { server: r.ok };
      },
    }),
    {
      name: 'mitra-assistant',
      version: 1,
      storage: createJSONStorage(() => guarded),
      // Location and in-flight state are never persisted.
      partialize: (s) => ({
        sessionId: s.sessionId,
        messages: s.messages,
        pinned: s.pinned,
        currentDay: s.currentDay,
      }),
    },
  ),
);

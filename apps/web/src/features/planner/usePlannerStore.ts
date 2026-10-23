import { create } from 'zustand';
import { useAppStore } from '../../store/useAppStore';
import type { Day, Itinerary } from './itinerary';
import {
  regenerateDay,
  serviceMode,
  streamPlan,
  type PlannerError,
  type ServiceMode,
} from './plannerApi';
import { cityForDay, dayForCity } from './selection';

export type Phase = 'idle' | 'planning' | 'ready' | 'error';

interface ChatMessage {
  role: 'user' | 'guide';
  text: string;
}

interface PlannerState {
  phase: Phase;
  /** Server stage: planning | retrying | invalid | sample. */
  stage: string | null;
  expectedDays: number | null;
  previews: Day[];
  itinerary: Itinerary | null;
  error: PlannerError | null;
  selectedDay: number | null;
  regenerating: number | null;
  dayError: { day: number; error: PlannerError } | null;
  mode: ServiceMode | null;
  messages: ChatMessage[];
  plan: (prompt: string, opts?: { change?: boolean; days?: number }) => Promise<void>;
  regenerate: (day: number, instruction: string) => Promise<void>;
  focusDay: (day: number | null) => void;
  focusCity: (cityId: string | null) => void;
  checkMode: () => Promise<void>;
  clear: () => void;
}

let controller: AbortController | null = null;

/** Days currently on screen: the final plan, or the previews while it streams in. */
export const visibleDays = (s: Pick<PlannerState, 'itinerary' | 'previews'>): Day[] =>
  s.itinerary?.days ?? s.previews;

export const usePlannerStore = create<PlannerState>()((set, get) => ({
  phase: 'idle',
  stage: null,
  expectedDays: null,
  previews: [],
  itinerary: null,
  error: null,
  selectedDay: null,
  regenerating: null,
  dayError: null,
  mode: null,
  messages: [],

  async plan(prompt, opts = {}) {
    controller?.abort();
    controller = new AbortController();
    const { persona, diet, language } = useAppStore.getState();
    const previous = opts.change ? (get().itinerary ?? undefined) : undefined;
    set((s) => ({
      phase: 'planning',
      stage: 'planning',
      previews: [],
      itinerary: opts.change ? s.itinerary : null,
      error: null,
      dayError: null,
      selectedDay: null,
      messages: [...s.messages, { role: 'user', text: prompt }],
    }));
    useAppStore.getState().setShowSampleRoute(false);

    await streamPlan(
      { prompt, persona, diet, language, days: opts.days, previous },
      {
        onStatus: (stage, days) =>
          set((s) => ({
            stage,
            expectedDays: days ?? s.expectedDays,
            // A failed attempt's previews are discarded before the retry.
            previews: stage === 'invalid' ? [] : s.previews,
          })),
        onDay: (day) =>
          set((s) => ({ previews: [...s.previews.filter((d) => d.day !== day.day), day] })),
        onNotice: () => undefined,
        onFinal: (itinerary) =>
          set((s) => ({
            phase: 'ready',
            stage: null,
            itinerary,
            previews: [],
            selectedDay: 1,
            messages: [...s.messages, { role: 'guide', text: itinerary.summary }],
          })),
        onError: (error) => set({ error, phase: get().itinerary ? 'ready' : 'error' }),
      },
      controller.signal,
    );
    const first = get().itinerary?.days[0];
    if (first) useAppStore.getState().selectCity(first.cityId);
  },

  async regenerate(day, instruction) {
    const it = get().itinerary;
    if (!it) return;
    const { persona, diet, language } = useAppStore.getState();
    set({ regenerating: day, dayError: null });
    const result = await regenerateDay({
      itinerary: it,
      day,
      instruction,
      persona,
      diet,
      language,
    });
    if ('error' in result) {
      set({ regenerating: null, dayError: { day, error: result.error } });
      return;
    }
    const days = it.days.map((d) => (d.day === day ? result.day : d));
    set({ regenerating: null, itinerary: { ...it, days } });
    get().focusDay(day);
  },

  focusDay(day) {
    set({ selectedDay: day });
    const city = cityForDay(visibleDays(get()), day);
    if (city) useAppStore.getState().selectCity(city);
  },

  focusCity(cityId) {
    useAppStore.getState().selectCity(cityId);
    set((s) => ({ selectedDay: dayForCity(visibleDays(s), cityId, s.selectedDay) }));
  },

  async checkMode() {
    set({ mode: await serviceMode() });
  },

  clear() {
    controller?.abort();
    set({
      phase: 'idle',
      stage: null,
      previews: [],
      itinerary: null,
      error: null,
      selectedDay: null,
      messages: [],
    });
  },
}));

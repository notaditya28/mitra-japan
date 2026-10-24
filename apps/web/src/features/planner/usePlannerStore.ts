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
import { useTripPrefs } from './tripPrefs';

/** A stop the map should fly to (only stops with real coordinates). */
export interface FocusedStop {
  day: number;
  index: number;
  name: string;
  lat: number;
  lng: number;
}

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
  /** The saved trip this plan was opened from or saved as (see features/trips). */
  activeTripId: string | null;
  focusedStop: FocusedStop | null;
  /** Bumped to send the 3D map back to the whole-Japan view. */
  resetView: number;
  focusStop: (day: number, index: number) => void;
  resetCamera: () => void;
  plan: (prompt: string, opts?: { change?: boolean; days?: number }) => Promise<void>;
  regenerate: (day: number, instruction: string) => Promise<void>;
  focusDay: (day: number | null) => void;
  focusCity: (cityId: string | null) => void;
  checkMode: () => Promise<void>;
  clear: () => void;
  /** Show a saved trip on the map and in the itinerary panel. */
  openTrip: (id: string, itinerary: Itinerary) => void;
  /** Swap in an itinerary changed by the assistant (patch applied or undone). */
  replaceItinerary: (itinerary: Itinerary) => void;
  setActiveTrip: (id: string | null) => void;
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
  activeTripId: null,
  focusedStop: null,
  resetView: 0,

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
      // A brand-new plan is not the saved trip any more; a change to it still is.
      activeTripId: opts.change ? s.activeTripId : null,
    }));
    useAppStore.getState().setShowSampleRoute(false);

    const prefs = useTripPrefs.getState().prefs;
    await streamPlan(
      {
        prompt,
        persona,
        diet,
        language,
        // A change keeps the plan's length unless the traveller asks otherwise.
        days: opts.days ?? (previous ? undefined : prefs.days),
        previous,
        startCity: prefs.startCity,
        travellers: prefs.travellers,
        pace: prefs.pace,
        budget: prefs.budget,
        interests: prefs.interests,
        diets: prefs.diets.filter((d) => d !== diet && d !== 'none'),
      },
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
      pace: it.days.find((d) => d.day === day)?.pace ?? useTripPrefs.getState().prefs.pace,
    });
    if ('error' in result) {
      set({ regenerating: null, dayError: { day, error: result.error } });
      return;
    }
    const days = it.days.map((d) => (d.day === day ? result.day : d));
    set({ regenerating: null, itinerary: { ...it, days } });
    get().focusDay(day);
  },

  focusStop(day, index) {
    const d = visibleDays(get()).find((x) => x.day === day);
    const s = d?.stops[index];
    if (!d || !s) return;
    set({ selectedDay: day });
    useAppStore.getState().selectCity(d.cityId);
    // Stops without coordinates (free-text suggestions) just focus their city.
    set({
      focusedStop:
        s.lat !== null && s.lng !== null
          ? { day, index, name: s.name, lat: s.lat, lng: s.lng }
          : null,
    });
  },

  resetCamera() {
    useAppStore.getState().selectCity(null);
    set((s) => ({ focusedStop: null, selectedDay: null, resetView: s.resetView + 1 }));
  },

  focusDay(day) {
    set({ selectedDay: day, focusedStop: null });
    const city = cityForDay(visibleDays(get()), day);
    if (city) useAppStore.getState().selectCity(city);
  },

  focusCity(cityId) {
    useAppStore.getState().selectCity(cityId);
    set((s) => ({
      selectedDay: dayForCity(visibleDays(s), cityId, s.selectedDay),
      focusedStop: null,
    }));
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
      activeTripId: null,
    });
  },

  openTrip(id, itinerary) {
    controller?.abort();
    set({
      phase: 'ready',
      stage: null,
      previews: [],
      itinerary,
      error: null,
      dayError: null,
      activeTripId: id,
      messages: [],
    });
    useAppStore.getState().setShowSampleRoute(false);
    get().focusDay(itinerary.days[0]?.day ?? null);
  },

  setActiveTrip(activeTripId) {
    set({ activeTripId });
  },

  replaceItinerary(itinerary) {
    set((s) => ({
      itinerary,
      phase: 'ready',
      // Keep the selected day if it still exists.
      selectedDay: s.selectedDay && s.selectedDay <= itinerary.days.length ? s.selectedDay : 1,
    }));
  },
}));

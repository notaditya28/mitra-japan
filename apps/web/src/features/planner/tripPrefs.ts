import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Diet } from '../../store/useAppStore';
import type { Pace } from './itinerary';

/**
 * Structured trip inputs from the team guide (section 2.2): duration 2-12 days,
 * starting city, travellers, pace, budget, interests and extra diets in the group.
 * Persona and the main diet stay in the profile (useAppStore). Saved in this browser.
 */
export type StartCity = 'tokyo' | 'kyoto' | 'osaka';
export type Budget = 'budget' | 'moderate' | 'premium';
export type Interest =
  'heritage' | 'nature' | 'food' | 'anime' | 'shopping' | 'spiritual' | 'culture';

export const START_CITIES: StartCity[] = ['tokyo', 'kyoto', 'osaka'];
export const BUDGETS: Budget[] = ['budget', 'moderate', 'premium'];
export const INTERESTS: Interest[] = [
  'heritage',
  'nature',
  'food',
  'anime',
  'shopping',
  'spiritual',
  'culture',
];
export const MIN_DAYS = 2;
export const MAX_DAYS = 12;

export interface TripPrefs {
  days: number;
  startCity: StartCity;
  travellers: number;
  /** null = let the guide choose from the persona. */
  pace: Pace | null;
  budget: Budget;
  interests: Interest[];
  /** Other diets in the group besides the profile's. */
  diets: Diet[];
}

export const DEFAULT_PREFS: TripPrefs = {
  days: 5,
  startCity: 'tokyo',
  travellers: 2,
  pace: null,
  budget: 'moderate',
  interests: [],
  diets: [],
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/** Keep stored or typed values inside the ranges the API accepts. */
export function sanitize(p: Partial<TripPrefs>): TripPrefs {
  const d = { ...DEFAULT_PREFS, ...p };
  return {
    days: clamp(Number.isFinite(d.days) ? d.days : 5, MIN_DAYS, MAX_DAYS),
    startCity: START_CITIES.includes(d.startCity) ? d.startCity : 'tokyo',
    travellers: clamp(Number.isFinite(d.travellers) ? d.travellers : 2, 1, 12),
    pace: d.pace === 'relaxed' || d.pace === 'moderate' || d.pace === 'fast' ? d.pace : null,
    budget: BUDGETS.includes(d.budget) ? d.budget : 'moderate',
    interests: d.interests.filter((i) => INTERESTS.includes(i)),
    diets: [...new Set(d.diets)].slice(0, 6),
  };
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
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* storage blocked: options still work for this visit */
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

export const useTripPrefs = create<{
  prefs: TripPrefs;
  set: (p: Partial<TripPrefs>) => void;
  toggleInterest: (i: Interest) => void;
  toggleDiet: (d: Diet) => void;
}>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      set: (p) => set((s) => ({ prefs: sanitize({ ...s.prefs, ...p }) })),
      toggleInterest: (i) =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            interests: s.prefs.interests.includes(i)
              ? s.prefs.interests.filter((x) => x !== i)
              : [...s.prefs.interests, i],
          },
        })),
      toggleDiet: (d) =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            diets: s.prefs.diets.includes(d)
              ? s.prefs.diets.filter((x) => x !== d)
              : [...s.prefs.diets, d],
          },
        })),
    }),
    {
      name: 'mitra-trip-prefs',
      version: 1,
      storage: createJSONStorage(() => guarded),
      merge: (persisted, current) => ({
        ...current,
        prefs: sanitize((persisted as { prefs?: Partial<TripPrefs> } | undefined)?.prefs ?? {}),
      }),
    },
  ),
);

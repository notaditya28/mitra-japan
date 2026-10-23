import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Persona = 'family' | 'honeymoon' | 'student' | 'foodie' | 'spiritual';
export type Diet = 'jain' | 'vegetarian' | 'vegan' | 'halal' | 'no-beef' | 'eggless' | 'none';
export type Language = 'en' | 'hi' | 'gu';
export type MapLayer = 'vegSafe' | 'heritage' | 'anime' | 'regional';

/** Demo sign-in only: kept in this browser, never sent anywhere. */
export interface DemoUser {
  name: string;
  /** 10-digit Indian mobile number, without the +91 prefix. */
  phone: string;
}

/** Itinerary shape is defined with the planner (milestone 5). */
export type Itinerary = unknown;

interface AppState {
  persona: Persona | null;
  diet: Diet;
  language: Language;
  layers: Record<MapLayer, boolean>;
  itinerary: Itinerary | null;
  user: DemoUser | null;
  /** Planner UI state (not persisted). */
  selectedCityId: string | null;
  showSampleRoute: boolean;
  setPersona: (p: Persona) => void;
  setDiet: (d: Diet) => void;
  setLanguage: (l: Language) => void;
  toggleLayer: (l: MapLayer) => void;
  setItinerary: (i: Itinerary | null) => void;
  selectCity: (id: string | null) => void;
  setShowSampleRoute: (v: boolean) => void;
  signIn: (u: DemoUser) => void;
  signOut: () => void;
}

// localStorage can throw in private mode; fall back to memory.
const safeStorage = createJSONStorage(() => {
  try {
    const probe = '__mitra_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      persona: null,
      diet: 'vegetarian',
      language: 'en',
      layers: { vegSafe: true, heritage: false, anime: false, regional: false },
      itinerary: null,
      user: null,
      selectedCityId: null,
      showSampleRoute: false,
      setPersona: (persona) => set({ persona }),
      setDiet: (diet) => set({ diet }),
      setLanguage: (language) => set({ language }),
      toggleLayer: (l) => set((s) => ({ layers: { ...s.layers, [l]: !s.layers[l] } })),
      setItinerary: (itinerary) => set({ itinerary }),
      selectCity: (selectedCityId) => set({ selectedCityId }),
      setShowSampleRoute: (showSampleRoute) => set({ showSampleRoute }),
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null, itinerary: null }),
    }),
    {
      name: 'mitra-japan',
      storage: safeStorage,
      partialize: (s) => ({ persona: s.persona, diet: s.diet, language: s.language, user: s.user }),
    },
  ),
);

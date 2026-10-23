import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Diet, Language, Persona } from '../../store/useAppStore';
import { parseItinerary, type Itinerary } from '../planner/itinerary';

/** Demo reservation: nothing is booked and no payment is taken. */
export interface DemoBooking {
  ref: string;
  createdAt: string;
  startDate: string;
  adults: number;
  children: number;
  seniors: number;
  rooms: number;
  leadName: string;
  notes: string;
}

export interface SavedTrip {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  persona: Persona | null;
  diet: Diet;
  language: Language;
  itinerary: Itinerary;
  booking: DemoBooking | null;
}

export const MAX_TRIPS = 30;
export const NAME_MAX = 60;
export const NOTES_MAX = 300;

export type TripError = 'full' | 'storage' | 'name' | 'missing';

type NewTrip = Pick<SavedTrip, 'name' | 'notes' | 'persona' | 'diet' | 'language' | 'itinerary'>;

interface TripsState {
  trips: SavedTrip[];
  /** Set when the browser refused to save (storage full or blocked). */
  storageError: boolean;
  create: (input: NewTrip) => { id: string } | { error: TripError };
  edit: (id: string, patch: { name?: string; notes?: string }) => TripError | null;
  replaceItinerary: (id: string, itinerary: Itinerary, diet: Diet) => void;
  duplicate: (id: string, copyLabel: string) => { id: string } | { error: TripError };
  remove: (id: string) => void;
  setBooking: (id: string, booking: DemoBooking | null) => void;
}

const now = () => new Date().toISOString();
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function cleanName(name: string): string | null {
  const n = name.trim().replace(/\s+/g, ' ');
  return n.length > 0 && n.length <= NAME_MAX ? n : null;
}

/** Re-validate what comes back from localStorage: anything malformed is dropped. */
export function reviveTrips(raw: unknown): SavedTrip[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((t: unknown) => {
    if (typeof t !== 'object' || t === null) return [];
    const o = t as Partial<SavedTrip>;
    const itinerary = parseItinerary(o.itinerary);
    if (!itinerary || typeof o.id !== 'string' || typeof o.name !== 'string') return [];
    return [
      {
        id: o.id,
        name: o.name,
        notes: typeof o.notes === 'string' ? o.notes : '',
        createdAt: typeof o.createdAt === 'string' ? o.createdAt : now(),
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : now(),
        persona: o.persona ?? null,
        diet: o.diet ?? 'vegetarian',
        language: o.language ?? 'en',
        itinerary,
        booking: o.booking ?? null,
      },
    ];
  });
}

let reportStorageError: (() => void) | null = null;

// localStorage can be full or blocked (private mode); say so instead of losing trips silently.
const guardedStorage: StateStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    if (typeof window === 'undefined') return; // tests / server rendering
    try {
      window.localStorage.setItem(k, v);
    } catch {
      reportStorageError?.();
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* nothing to remove */
    }
  },
};

/** Saved trips, kept only in this browser. */
export const useTrips = create<TripsState>()(
  persist(
    (set, get) => ({
      trips: [],
      storageError: false,

      create(input) {
        const name = cleanName(input.name);
        if (!name) return { error: 'name' };
        if (get().trips.length >= MAX_TRIPS) return { error: 'full' };
        const id = newId();
        const t = now();
        const trip: SavedTrip = {
          ...input,
          id,
          name,
          notes: input.notes.trim().slice(0, NOTES_MAX),
          createdAt: t,
          updatedAt: t,
          booking: null,
        };
        set((s) => ({ trips: [trip, ...s.trips] }));
        return get().storageError ? { error: 'storage' } : { id };
      },

      edit(id, patch) {
        if (!get().trips.some((t) => t.id === id)) return 'missing';
        const name = patch.name === undefined ? undefined : cleanName(patch.name);
        if (name === null) return 'name';
        set((s) => ({
          trips: s.trips.map((t) =>
            t.id === id
              ? {
                  ...t,
                  name: name ?? t.name,
                  notes:
                    patch.notes === undefined ? t.notes : patch.notes.trim().slice(0, NOTES_MAX),
                  updatedAt: now(),
                }
              : t,
          ),
        }));
        return null;
      },

      replaceItinerary(id, itinerary, diet) {
        set((s) => ({
          trips: s.trips.map((t) =>
            t.id === id ? { ...t, itinerary, diet, updatedAt: now() } : t,
          ),
        }));
      },

      duplicate(id, copyLabel) {
        const src = get().trips.find((t) => t.id === id);
        if (!src) return { error: 'missing' };
        if (get().trips.length >= MAX_TRIPS) return { error: 'full' };
        const copyId = newId();
        const t = now();
        const name = `${src.name} (${copyLabel})`.slice(0, NAME_MAX);
        const copy: SavedTrip = {
          ...src,
          id: copyId,
          name,
          createdAt: t,
          updatedAt: t,
          booking: null,
        };
        set((s) => ({ trips: [copy, ...s.trips] }));
        return { id: copyId };
      },

      remove(id) {
        set((s) => ({ trips: s.trips.filter((t) => t.id !== id) }));
      },

      setBooking(id, booking) {
        set((s) => ({
          trips: s.trips.map((t) => (t.id === id ? { ...t, booking, updatedAt: now() } : t)),
        }));
      },
    }),
    {
      name: 'mitra-trips',
      version: 1,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (s) => ({ trips: s.trips }),
      merge: (persisted, current) => ({
        ...current,
        trips: reviveTrips((persisted as { trips?: unknown } | undefined)?.trips),
      }),
    },
  ),
);

reportStorageError = () => useTrips.setState({ storageError: true });

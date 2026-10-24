import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addDays, localDay } from '../../lib/dates';
import { cityById } from '../planner/data';
import type { Itinerary } from '../planner/itinerary';

/**
 * Schedule of Stay (Taizai Nitteihyo) draft: the day-by-day table consulates ask
 * for (date, activities, accommodation name, address, phone). Our own plain
 * layout, never a copy of the official form (owner decision, 2026-10-24); the
 * traveller fills in what we can't know (hotels, addresses, phone numbers).
 */

export interface ScheduleEntry {
  /** Edited activities; undefined means "use the plan's stops". */
  activities?: string;
  hotel: string;
  address: string;
  phone: string;
}

export interface ScheduleRow {
  day: number;
  date: string | null;
  city: string;
  activities: string;
  hotel: string;
  address: string;
  phone: string;
  /** Hotel, address or phone still empty: the guide warns vague entries cause delays. */
  missing: ('hotel' | 'address' | 'phone')[];
}

export interface ScheduleDraft {
  applicant: string;
  startDate: string;
  entries: Record<number, ScheduleEntry>;
}

const EMPTY: ScheduleEntry = { hotel: '', address: '', phone: '' };

/** One key per plan, so drafts for different trips don't mix. */
export const planKey = (it: Itinerary): string =>
  `${it.days.length}:${it.days.map((d) => d.cityId).join(',')}:${it.summary.slice(0, 40)}`;

const parseDate = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const defaultActivities = (it: Itinerary, day: number): string =>
  it.days
    .find((d) => d.day === day)
    ?.stops.map((s) => s.name)
    .join(', ') ?? '';

export function buildSchedule(it: Itinerary, draft: ScheduleDraft): ScheduleRow[] {
  const start = parseDate(draft.startDate);
  return it.days.map((d) => {
    const e = draft.entries[d.day] ?? EMPTY;
    const city = cityById(d.cityId);
    const missing = (['hotel', 'address', 'phone'] as const).filter((k) => !e[k].trim());
    return {
      day: d.day,
      date: start ? localDay(addDays(start, d.day - 1)) : null,
      city: city ? `${city.name} (${city.nameJa})` : d.cityId,
      activities: (e.activities ?? defaultActivities(it, d.day)).trim(),
      hotel: e.hotel.trim(),
      address: e.address.trim(),
      phone: e.phone.trim(),
      missing,
    };
  });
}

interface ScheduleState {
  drafts: Record<string, ScheduleDraft>;
  update: (key: string, patch: Partial<Omit<ScheduleDraft, 'entries'>>) => void;
  updateEntry: (key: string, day: number, patch: Partial<ScheduleEntry>) => void;
  clear: (key: string) => void;
}

export const emptyDraft = (): ScheduleDraft => ({ applicant: '', startDate: '', entries: {} });

/** Drafts live only in this browser (localStorage). No passport or ID numbers are asked for. */
export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set) => ({
      drafts: {},
      update: (key, patch) =>
        set((s) => ({
          drafts: { ...s.drafts, [key]: { ...(s.drafts[key] ?? emptyDraft()), ...patch } },
        })),
      updateEntry: (key, day, patch) =>
        set((s) => {
          const d = s.drafts[key] ?? emptyDraft();
          return {
            drafts: {
              ...s.drafts,
              [key]: {
                ...d,
                entries: { ...d.entries, [day]: { ...(d.entries[day] ?? EMPTY), ...patch } },
              },
            },
          };
        }),
      clear: (key) =>
        set((s) => ({
          drafts: Object.fromEntries(Object.entries(s.drafts).filter(([k]) => k !== key)),
        })),
    }),
    { name: 'mitra-schedule', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

/** The draft being printed (rendered off-screen by SchedulePrint). */
export const useSchedulePrint = create<{
  doc: { applicant: string; rows: ScheduleRow[]; generatedAt: string } | null;
  print: (doc: { applicant: string; rows: ScheduleRow[] }) => void;
  done: () => void;
}>()((set) => ({
  doc: null,
  print: (doc) => set({ doc: { ...doc, generatedAt: localDay() } }),
  done: () => set({ doc: null }),
}));

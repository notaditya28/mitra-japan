import { cityById } from './data';

/** Mirrors apps/api/app/schema.py (Itinerary, Day, …). Validated at the boundary. */
export type StopKind =
  'sight' | 'food' | 'temple' | 'heritage' | 'anime' | 'nature' | 'onsen' | 'shopping' | 'culture';
export type TransportMode =
  'walk' | 'local-train' | 'shinkansen' | 'limited-express' | 'bus' | 'ferry' | 'flight' | 'none';
export type StayType = 'hotel' | 'ryokan' | 'temple-lodging' | 'hostel' | 'none';
/** Team guide planner inputs (MITRA_JAPAN_SYSTEM_GUIDE.md section 2.2). */
export type Pace = 'relaxed' | 'moderate' | 'fast';
export type Slot = 'morning' | 'afternoon' | 'evening';
export const SLOTS: Slot[] = ['morning', 'afternoon', 'evening'];
export const PACES: Pace[] = ['relaxed', 'moderate', 'fast'];

export type FlagCode =
  'overpacked' | 'long-transfer' | 'spread-out' | 'unknown-place' | 'dropped-day';

export interface Stop {
  name: string;
  kind: StopKind;
  foodSpotId: string | null;
  heritageId: string | null;
  note: string;
  inOurData: boolean;
  /** Morning, afternoon or evening; older plans without it count as afternoon. */
  slot: Slot;
  /** Rough time to allow, an estimate. */
  durationMinutes: number | null;
  /** Real coordinates, only for stops that point at our data. */
  lat: number | null;
  lng: number | null;
}

export interface Meals {
  breakfast: string;
  lunch: string;
  dinner: string;
  dietaryNotes: string;
}

export interface Day {
  day: number;
  cityId: string;
  title: string;
  stops: Stop[];
  transport: {
    mode: TransportMode;
    fromCityId: string | null;
    note: string;
    estimatedHours: number | null;
    distanceKm: number | null;
  };
  stay: { area: string; type: StayType; note: string };
  foodNotes: string;
  foodReasons: string[];
  tips: string[];
  flags: { code: FlagCode; message: string }[];
  meals: Meals;
  pace: Pace | null;
}

export interface Itinerary {
  summary: string;
  days: Day[];
  visaChecklist: string[];
  bestSeason: string;
  etiquetteTips: string[];
  source: 'live' | 'sample';
  model: string | null;
  notices: string[];
}

const STOP_KINDS = new Set<string>([
  'sight',
  'food',
  'temple',
  'heritage',
  'anime',
  'nature',
  'onsen',
  'shopping',
  'culture',
]);
const MODES = new Set<string>([
  'walk',
  'local-train',
  'shinkansen',
  'limited-express',
  'bus',
  'ferry',
  'flight',
  'none',
]);
const STAYS = new Set<string>(['hotel', 'ryokan', 'temple-lodging', 'hostel', 'none']);
const FLAGS = new Set<string>([
  'overpacked',
  'long-transfer',
  'spread-out',
  'unknown-place',
  'dropped-day',
]);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string | null =>
  typeof v === 'string' ? v : v === undefined ? fallback : null;
const strOrNull = (v: unknown): string | null | undefined =>
  v === null || v === undefined ? null : typeof v === 'string' ? v : undefined;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strings = (v: unknown): string[] | null =>
  v === undefined
    ? []
    : Array.isArray(v) && v.every((x) => typeof x === 'string')
      ? (v as string[])
      : null;

function parseStop(v: unknown): Stop | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  const note = str(v.note);
  const foodSpotId = strOrNull(v.foodSpotId);
  const heritageId = strOrNull(v.heritageId);
  if (!name || note === null || typeof v.kind !== 'string' || !STOP_KINDS.has(v.kind)) return null;
  if (foodSpotId === undefined || heritageId === undefined) return null;
  return {
    name,
    kind: v.kind as StopKind,
    foodSpotId,
    heritageId,
    note,
    inOurData: v.inOurData === true,
    slot: SLOTS.includes(v.slot as Slot) ? (v.slot as Slot) : 'afternoon',
    durationMinutes: num(v.durationMinutes),
    lat: num(v.lat),
    lng: num(v.lng),
  };
}

function parseMeals(v: unknown): Meals {
  const m = isObj(v) ? v : {};
  return {
    breakfast: str(m.breakfast) ?? '',
    lunch: str(m.lunch) ?? '',
    dinner: str(m.dinner) ?? '',
    dietaryNotes: str(m.dietaryNotes) ?? '',
  };
}

/** Validate one day; also rejects days in a city we have no data for. */
export function parseDay(v: unknown): Day | null {
  if (!isObj(v) || !isObj(v.transport) || !isObj(v.stay)) return null;
  const day = num(v.day);
  const cityId = str(v.cityId);
  const title = str(v.title);
  if (day === null || !Number.isInteger(day) || day < 1 || !cityId || !title) return null;
  if (!cityById(cityId)) return null;
  if (!Array.isArray(v.stops) || v.stops.length === 0) return null;
  const stops = v.stops.map(parseStop);
  if (stops.some((s) => s === null)) return null;

  const t = v.transport;
  const fromCityId = strOrNull(t.fromCityId);
  if (typeof t.mode !== 'string' || !MODES.has(t.mode) || fromCityId === undefined) return null;
  const s = v.stay;
  if (typeof s.type !== 'string' || !STAYS.has(s.type)) return null;

  const foodReasons = strings(v.foodReasons);
  const tips = strings(v.tips);
  const flags = v.flags === undefined ? [] : Array.isArray(v.flags) ? v.flags : null;
  if (!foodReasons || !tips || !flags) return null;
  const parsedFlags = flags.flatMap((f) =>
    isObj(f) && typeof f.code === 'string' && FLAGS.has(f.code) && typeof f.message === 'string'
      ? [{ code: f.code as FlagCode, message: f.message }]
      : [],
  );

  return {
    day,
    cityId,
    title,
    stops: stops as Stop[],
    transport: {
      mode: t.mode as TransportMode,
      fromCityId,
      note: str(t.note) ?? '',
      estimatedHours: num(t.estimatedHours),
      distanceKm: num(t.distanceKm),
    },
    stay: { area: str(s.area) ?? '', type: s.type as StayType, note: str(s.note) ?? '' },
    foodNotes: str(v.foodNotes) ?? '',
    foodReasons,
    tips,
    flags: parsedFlags,
    meals: parseMeals(v.meals),
    pace: PACES.includes(v.pace as Pace) ? (v.pace as Pace) : null,
  };
}

/** Validate a whole itinerary from the API (or storage). Returns null if it cannot be trusted. */
export function parseItinerary(v: unknown): Itinerary | null {
  if (!isObj(v)) return null;
  if (v.source !== 'live' && v.source !== 'sample') return null;
  const summary = str(v.summary);
  if (summary === null || !Array.isArray(v.days)) return null;
  const days = v.days.map(parseDay).filter((d): d is Day => d !== null);
  if (days.length === 0) return null;
  const visaChecklist = strings(v.visaChecklist);
  const etiquetteTips = strings(v.etiquetteTips);
  const notices = strings(v.notices);
  if (!visaChecklist || !etiquetteTips || !notices) return null;
  const dropped = v.days.length - days.length;
  return {
    summary,
    days,
    visaChecklist,
    bestSeason: str(v.bestSeason) ?? '',
    etiquetteTips,
    source: v.source,
    model: typeof v.model === 'string' ? v.model : null,
    notices:
      dropped > 0
        ? [...notices, `${dropped} day(s) could not be validated and were removed.`]
        : notices,
  };
}

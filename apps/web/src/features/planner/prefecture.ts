import { prefectureAt, prefectureCentre, prefectureName } from '../../lib/japanMap';
import type { MapLayer } from '../../store/useAppStore';
import {
  ANIME_SPOTS,
  CITIES,
  FOOD_SPOTS,
  HERITAGE_SPOTS,
  REGIONAL_SPOTS,
  distanceKm,
  type City,
} from './data';

export type Region =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kansai'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu'
  | 'okinawa';

/** The usual regional grouping by JIS prefecture code (01-47), with Okinawa on its own. */
export function regionOf(id: string): Region | null {
  const n = Number(id.replace(/^JP-/, ''));
  if (!Number.isInteger(n) || n < 1 || n > 47) return null;
  if (n === 1) return 'hokkaido';
  if (n <= 7) return 'tohoku';
  if (n <= 14) return 'kanto';
  if (n <= 23) return 'chubu';
  if (n <= 30) return 'kansai';
  if (n <= 35) return 'chugoku';
  if (n <= 39) return 'shikoku';
  if (n <= 46) return 'kyushu';
  return 'okinawa';
}

export interface PrefecturePlace {
  id: string;
  layer: MapLayer;
  name: string;
  detail: string;
}

export interface PrefectureInfo {
  id: string;
  name: string;
  nameJa: string;
  region: Region | null;
  centre: { lng: number; lat: number };
  /** Our cities inside the prefecture. */
  cities: City[];
  /** Map-layer places from our data inside the prefecture. */
  places: PrefecturePlace[];
  /** Our nearest cities by straight-line distance from the prefecture's centre. */
  nearest: { city: City; km: number }[];
}

let byPrefecture: Map<string, PrefecturePlace[]> | null = null;

/** Every map-layer place, grouped by the prefecture it sits in (built once, on first use). */
function placesIndex(): Map<string, PrefecturePlace[]> {
  if (byPrefecture) return byPrefecture;
  const all: (PrefecturePlace & { lng: number; lat: number })[] = [
    ...FOOD_SPOTS.map((f) => ({ id: f.id, layer: 'vegSafe' as const, name: f.title, detail: f.area, lng: f.lng, lat: f.lat })),
    ...HERITAGE_SPOTS.map((h) => ({ id: h.id, layer: 'heritage' as const, name: h.japanese, detail: h.place, lng: h.lng, lat: h.lat })),
    ...ANIME_SPOTS.map((a) => ({ id: a.id, layer: 'anime' as const, name: a.name, detail: a.note, lng: a.lng, lat: a.lat })),
    ...REGIONAL_SPOTS.map((r) => ({ id: r.id, layer: 'regional' as const, name: r.name, detail: r.note, lng: r.lng, lat: r.lat })),
  ];
  byPrefecture = new Map();
  for (const { lng, lat, ...p } of all) {
    const pref = prefectureAt(lng, lat);
    if (!pref) continue;
    byPrefecture.set(pref, [...(byPrefecture.get(pref) ?? []), p]);
  }
  return byPrefecture;
}

/**
 * What we can honestly say about a prefecture from our own data: its names, region, the
 * places we list there and our nearest cities. Nothing here is invented or looked up live.
 */
export function prefectureInfo(id: string): PrefectureInfo | null {
  const props = prefectureName(id);
  const c = prefectureCentre(id);
  if (!props || !c) return null;
  const centre = { lng: c[0], lat: c[1] };
  const cities = CITIES.filter((x) => prefectureAt(x.lng, x.lat) === id);
  const nearest = CITIES.filter((x) => !cities.includes(x))
    .map((city) => ({ city, km: Math.round(distanceKm(centre, city)) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 3);
  return {
    id,
    name: props.name,
    nameJa: props.nameJa,
    region: regionOf(id),
    centre,
    cities,
    places: placesIndex().get(id) ?? [],
    nearest,
  };
}

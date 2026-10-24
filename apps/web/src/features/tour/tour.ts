import tourJson from '../../data/tour.json';
import photosJson from '../../data/tourPhotos.json';
import type { DataStatus } from '../planner/data';
import { cityLite as cityById } from './cities';
import type { FearId } from '../../scenes/fears';

/**
 * The Stage 1 journey as data: a flight from Delhi to the first city, then each
 * city's spots (one photo each), with a Shinkansen ride between cities.
 * Three-free so the first paint, the chapter rail and the city map window can use it.
 */

export interface PhotoCredit {
  credit: string | null;
  source: string | null;
  licence: string | null;
}

export interface Spot {
  /** "<city>/<slug>", the same id as the photo manifest. */
  id: string;
  cityId: string;
  name: string;
  nameJa: string;
  /** Short Japanese label the portal petals spell out. */
  kanji: string;
  area: string;
  lat: number;
  lng: number;
  fear: FearId | null;
  /** Point of interest in the photo (0..1), kept in frame when cropping. */
  focus: [number, number];
  status: DataStatus;
  photo: PhotoCredit;
  photoNote?: string;
  /** Image URLs: large for desktop, small for phones and mid-tier devices. */
  src: { lg: string; sm: string };
  /** Original pixel size, for the crop maths. */
  width: number;
  height: number;
}

export interface TourCity {
  id: string;
  name: string;
  nameJa: string;
  lat: number;
  lng: number;
  spots: Spot[];
}

export type Segment =
  | { kind: 'flight'; kanji: string; cityId: string; weight: number }
  | { kind: 'spot'; kanji: string; cityId: string; spot: Spot; first: boolean; weight: number }
  | { kind: 'train'; kanji: string; cityId: string; from: string; weight: number };

/** Relative scroll length of each kind of segment. */
export const WEIGHTS = { flight: 2.2, spot: 1, train: 1.6 } as const;
/** Scroll length of one weight unit, in viewport heights. */
export const VH_PER_UNIT = 120;

interface RawSpot {
  name: string;
  nameJa: string;
  kanji: string;
  area: string;
  lat: number;
  lng: number;
  fear: string | null;
  focus: number[];
  status: string;
  photo: PhotoCredit;
  photoNote?: string;
}

interface PhotoEntry {
  id: string;
  city: string;
  slug: string;
  width: number;
  height: number;
}

const urls = import.meta.glob<string>('../../assets/tour/*/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const urlFor = (city: string, slug: string, size: 'lg' | 'sm') =>
  urls[`../../assets/tour/${city}/${slug}-${size}.webp`];

const FEARS: readonly string[] = ['food', 'language', 'visa', 'foreign'];
const asFear = (f: string | null | undefined): FearId | null =>
  f && FEARS.includes(f) ? (f as FearId) : null;

const prettify = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function buildSpot(id: string): Spot | null {
  const photo = (photosJson.photos as PhotoEntry[]).find((p) => p.id === id);
  const city = id.split('/')[0] ?? '';
  const slug = id.split('/')[1] ?? '';
  const lg = urlFor(city, slug, 'lg');
  const sm = urlFor(city, slug, 'sm');
  if (!photo || !lg || !sm) return null;
  const raw = (tourJson.spots as Record<string, RawSpot | undefined>)[id];
  const c = cityById(city);
  // A photo dropped in a folder but not yet described still shows, clearly unreviewed.
  return {
    id,
    cityId: city,
    name: raw?.name ?? prettify(slug),
    nameJa: raw?.nameJa ?? c?.nameJa ?? '',
    kanji: raw?.kanji ?? c?.nameJa ?? '旅',
    area: raw?.area ?? '',
    lat: raw?.lat ?? c?.lat ?? 0,
    lng: raw?.lng ?? c?.lng ?? 0,
    fear: asFear(raw?.fear),
    focus: [raw?.focus[0] ?? 0.5, raw?.focus[1] ?? 0.5],
    status: raw?.status === 'verified' ? 'verified' : 'needs-review',
    photo: raw?.photo ?? { credit: null, source: null, licence: null },
    photoNote: raw?.photoNote,
    src: { lg, sm },
    width: photo.width,
    height: photo.height,
  };
}

function buildCities(): TourCity[] {
  const listed = tourJson.cities.map((c) => c.id);
  const photoCities = [...new Set((photosJson.photos as PhotoEntry[]).map((p) => p.city))];
  // Cities with photos but no entry in tour.json join at the end, in folder order.
  const order = [...listed, ...photoCities.filter((c) => !listed.includes(c))];
  return order.flatMap((id) => {
    const city = cityById(id);
    if (!city) return [];
    const listedSpots = tourJson.cities.find((c) => c.id === id)?.spots ?? [];
    const extra = (photosJson.photos as PhotoEntry[])
      .filter((p) => p.city === id && !listedSpots.includes(p.id))
      .map((p) => p.id);
    const spots = [...listedSpots, ...extra].map(buildSpot).filter((s): s is Spot => s !== null);
    if (spots.length === 0) return [];
    return [{ id, name: city.name, nameJa: city.nameJa, lat: city.lat, lng: city.lng, spots }];
  });
}

export const FROM = tourJson.from;
export const TOUR_CITIES: TourCity[] = buildCities();
export const TRAIN_FEAR: FearId | null = asFear(tourJson.trainFear);

export function buildSegments(cities: TourCity[]): Segment[] {
  const first = cities[0];
  if (!first) return [];
  const out: Segment[] = [
    { kind: 'flight', kanji: first.nameJa, cityId: first.id, weight: WEIGHTS.flight },
  ];
  cities.forEach((city, ci) => {
    if (ci > 0) {
      out.push({
        kind: 'train',
        kanji: '新幹線',
        cityId: city.id,
        from: cities[ci - 1]?.id ?? '',
        weight: WEIGHTS.train,
      });
    }
    city.spots.forEach((spot, si) => {
      out.push({
        kind: 'spot',
        // Arriving in a city spells the city's name; moving within it, the spot's.
        kanji: si === 0 ? city.nameJa : spot.kanji,
        cityId: city.id,
        spot,
        first: si === 0,
        weight: WEIGHTS.spot,
      });
    });
  });
  return out;
}

export const SEGMENTS: Segment[] = buildSegments(TOUR_CITIES);

/** Where each segment starts, in weight units, plus the total. */
export function layout(segments: Segment[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let acc = 0;
  for (const s of segments) {
    starts.push(acc);
    acc += s.weight;
  }
  return { starts, total: acc };
}

export const LAYOUT = layout(SEGMENTS);

/** Height of the scrolling tour section, in viewport heights. */
export const TOUR_VH = LAYOUT.total * VH_PER_UNIT + 100;

/** City whose map the window shows while this segment is on screen (null during the flight). */
export function mapCityFor(segments: Segment[], index: number): string | null {
  const s = segments[index];
  if (!s || s.kind === 'flight') return null;
  // On the train you are still in the city you left until you arrive.
  return s.kind === 'train' ? s.from : s.cityId;
}

/** Transitions inside a city are a plain veil; arriving somewhere new gets the petal kanji. */
export const isPlainBoundary = (segments: Segment[], index: number): boolean => {
  const s = segments[index];
  return s?.kind === 'spot' && !s.first;
};

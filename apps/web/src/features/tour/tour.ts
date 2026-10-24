import tourJson from '../../data/tour.json';
import type { DataStatus } from '../planner/data';
import { cityLite as cityById } from './cities';

/**
 * The Stage 1 journey as data: a flight from Delhi to the first city, then each
 * city's spots (one stylised 3D scene each), with a Shinkansen ride between cities.
 * Three-free so the first paint, the chapter rail and the city map window can use it.
 */

/** The low-poly 3D scenes a spot can show (`src/scenes/places/`). */
export const PLACE_SCENES = ['tokyo', 'fuji', 'kyoto', 'matsuri'] as const;
export type PlaceScene = (typeof PLACE_SCENES)[number];

export interface Spot {
  /** "<city>/<slug>". */
  id: string;
  /** Key for the translated name, area and paragraph (`tour.spots.<slug>`). */
  slug: string;
  cityId: string;
  name: string;
  nameJa: string;
  /** Short Japanese label for the static (no-3D) card. */
  kanji: string;
  area: string;
  /** Approximate, only for the "you are here" pin on the city map. */
  lat: number;
  lng: number;
  scene: PlaceScene;
  status: DataStatus;
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
  | { kind: 'flight'; cityId: string; weight: number }
  | { kind: 'spot'; cityId: string; spot: Spot; first: boolean; weight: number }
  | { kind: 'train'; cityId: string; from: string; weight: number };

/** Relative scroll length of each kind of segment. */
export const WEIGHTS = { flight: 2.2, spot: 1.4, train: 1.6 } as const;
/** Scroll length of one weight unit, in viewport heights. */
export const VH_PER_UNIT = 120;

interface RawSpot {
  name: string;
  nameJa: string;
  kanji: string;
  area: string;
  lat: number;
  lng: number;
  scene: string;
  status: string;
}

const asScene = (s: string | undefined): PlaceScene | null =>
  PLACE_SCENES.find((p) => p === s) ?? null;

function buildSpot(id: string): Spot | null {
  const raw = (tourJson.spots as Record<string, RawSpot | undefined>)[id];
  const scene = asScene(raw?.scene);
  // A spot without a known 3D scene has nothing to show.
  if (!raw || !scene) return null;
  return {
    id,
    slug: id.split('/')[1] ?? id,
    cityId: id.split('/')[0] ?? '',
    name: raw.name,
    nameJa: raw.nameJa,
    kanji: raw.kanji,
    area: raw.area,
    lat: raw.lat,
    lng: raw.lng,
    scene,
    status: raw.status === 'verified' ? 'verified' : 'needs-review',
  };
}

function buildCities(): TourCity[] {
  return tourJson.cities.flatMap(({ id, spots: ids }) => {
    const city = cityById(id);
    if (!city) return [];
    const spots = ids.map(buildSpot).filter((s): s is Spot => s !== null);
    if (spots.length === 0) return [];
    return [{ id, name: city.name, nameJa: city.nameJa, lat: city.lat, lng: city.lng, spots }];
  });
}

export const FROM = tourJson.from;
export const TOUR_CITIES: TourCity[] = buildCities();

export function buildSegments(cities: TourCity[]): Segment[] {
  const first = cities[0];
  if (!first) return [];
  const out: Segment[] = [{ kind: 'flight', cityId: first.id, weight: WEIGHTS.flight }];
  cities.forEach((city, ci) => {
    if (ci > 0) {
      out.push({
        kind: 'train',
        cityId: city.id,
        from: cities[ci - 1]?.id ?? '',
        weight: WEIGHTS.train,
      });
    }
    city.spots.forEach((spot, si) => {
      out.push({
        kind: 'spot',
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

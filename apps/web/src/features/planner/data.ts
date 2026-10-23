import citiesJson from '../../data/cities.json';
import restaurantsJson from '../../data/restaurants.json';
import layersJson from '../../data/layers.json';
import heritageJson from '../../data/heritage.json';
import type { Diet } from '../../store/useAppStore';

export type VegLevel = 'high' | 'medium' | 'low';
export type DataStatus = 'verified' | 'sample' | 'needs-review';

export interface City {
  id: string;
  name: string;
  nameJa: string;
  lat: number;
  lng: number;
  tags: string[];
  fromTokyo: string;
  season: string;
  culture: string;
  veg: string;
  vegLevel: VegLevel;
  status: DataStatus;
  lastChecked: string | null;
}

/** How we know a restaurant suits a diet (owner rule: never "certified" without evidence). */
export type DietBasis = 'self-reported' | 'third-party' | 'independently-verified' | 'unconfirmed';

export interface DietOption {
  diet: Diet;
  basis: DietBasis;
  evidence: string | null;
}

/**
 * One directory entry. `sample` entries are illustrative kinds of places;
 * `needs-review` entries are real places from public sources, unconfirmed.
 * Rules enforced by data.test.ts.
 */
export interface Restaurant {
  id: string;
  cityId: string;
  name: string;
  nameJa: string | null;
  kind: string;
  cuisine: string;
  address: string | null;
  area: string;
  lat: number;
  lng: number;
  coordinatePrecision: 'area' | 'approximate' | 'exact';
  dietOptions: DietOption[];
  risks: string[];
  note: string;
  link: string | null;
  certification: { body: string; evidence: string; checked: string } | null;
  source: string;
  lastChecked: string | null;
  status: DataStatus;
}

/** The planner's view of a restaurant: which diets it is listed for. */
export interface FoodSpot extends Restaurant {
  title: string;
  diets: Diet[];
}

export interface LayerSpot {
  id: string;
  cityId: string;
  name: string;
  lat: number;
  lng: number;
  note: string;
  status: DataStatus;
}

export interface HeritageSpot {
  id: string;
  japanese: string;
  kanji: string;
  indian: string;
  story: string;
  place: string;
  lat: number;
  lng: number;
  references: string[];
  status: DataStatus;
  lastChecked: string | null;
}

export const CITIES = citiesJson.cities as City[];
export const RESTAURANTS = restaurantsJson.restaurants as Restaurant[];
export const FOOD_SPOTS: FoodSpot[] = RESTAURANTS.map((r) => ({
  ...r,
  title: r.name,
  diets: r.dietOptions.map((o) => o.diet),
}));
export const ANIME_SPOTS = layersJson.anime as LayerSpot[];
export const REGIONAL_SPOTS = layersJson.regional as LayerSpot[];
export const HERITAGE_SPOTS = heritageJson.deities as HeritageSpot[];

export const cityById = (id: string): City | undefined => CITIES.find((c) => c.id === id);
export const spotsForCity = (id: string): FoodSpot[] => FOOD_SPOTS.filter((s) => s.cityId === id);
export const animeForCity = (id: string): LayerSpot[] => ANIME_SPOTS.filter((s) => s.cityId === id);
export const regionalForCity = (id: string): LayerSpot[] =>
  REGIONAL_SPOTS.filter((s) => s.cityId === id);

/** Great-circle distance in km, used to link Indian-roots temples to nearby cities. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const heritageNear = (city: City, km = 60): HeritageSpot[] =>
  HERITAGE_SPOTS.filter((h) => distanceKm(city, h) <= km);

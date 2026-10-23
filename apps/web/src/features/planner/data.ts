import citiesJson from '../../data/cities.json';
import foodJson from '../../data/foodSpots.json';
import layersJson from '../../data/layers.json';
import heritageJson from '../../data/heritage.json';
import type { Diet } from '../../store/useAppStore';

export type VegLevel = 'high' | 'medium' | 'low';

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
}

/** Demo data only: never certified, never verified (enforced by data.test.ts). */
export interface FoodSpot {
  id: string;
  cityId: string;
  title: string;
  kind: string;
  area: string;
  lat: number;
  lng: number;
  diets: Diet[];
  risks: string[];
  note: string;
  certified: false;
  verified: false;
}

export interface LayerSpot {
  id: string;
  cityId: string;
  name: string;
  lat: number;
  lng: number;
  note: string;
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
}

export const CITIES = citiesJson.cities as City[];
export const FOOD_SPOTS = foodJson.spots as FoodSpot[];
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

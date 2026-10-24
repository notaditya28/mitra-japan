import citiesJson from '../../data/cities.json';

/**
 * Name and position of a city, straight from cities.json. The tour uses this
 * instead of planner/data so first paint doesn't pull in the restaurant, layer
 * and heritage data.
 */
export interface CityLite {
  id: string;
  name: string;
  nameJa: string;
  lat: number;
  lng: number;
}

const CITIES = citiesJson.cities as CityLite[];

export const cityLite = (id: string): CityLite | undefined => CITIES.find((c) => c.id === id);

import { geoInterpolate, geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import asiaRaw from '../../data/asia.geojson?raw';
import { FROM, TOUR_CITIES } from './tour';

/**
 * The flight map: Natural Earth 1:10m admin-0, India point of view (public domain),
 * cut to South and East Asia by scripts/asia_subset.py. One Mercator projection
 * for both the 3D flight and the flat fallback. Three-free.
 */

export interface Country {
  id: string;
  name: string;
  geometry: GeoPermissibleObjects;
}

interface Fc {
  features: { properties: { id: string; name: string }; geometry: GeoPermissibleObjects }[];
}

export const COUNTRIES: Country[] = (JSON.parse(asiaRaw) as Fc).features.map((f) => ({
  id: f.properties.id,
  name: f.properties.name,
  geometry: f.geometry,
}));

/** Map window: west of India to east of Japan. */
const WINDOW: GeoPermissibleObjects = {
  type: 'MultiPoint',
  coordinates: [
    [63, 4],
    [147, 49],
  ],
};

/** Pixel size of the drawn map (texture or SVG viewBox). */
export const MAP_W = 2048;
export const projection = geoMercator().fitWidth(MAP_W, WINDOW);
const [[, y0] = [0, 0], [, y1] = [0, 0]] = geoPath(projection).bounds(WINDOW);
export const MAP_H = Math.round(y1 - y0);
projection.translate([projection.translate()[0], projection.translate()[1] - y0]);

export const path = geoPath(projection);

export function project(lng: number, lat: number): [number, number] {
  return projection([lng, lat]) ?? [0, 0];
}

export const ORIGIN: [number, number] = [FROM.lng, FROM.lat];
const first = TOUR_CITIES[0];
export const DESTINATION: [number, number] = first ? [first.lng, first.lat] : [139.69, 35.69];

/** Great-circle route Delhi → first city, as lng/lat samples (s = 0..1). */
export function routeLngLat(samples = 120): [number, number][] {
  const at = geoInterpolate(ORIGIN, DESTINATION);
  return Array.from({ length: samples + 1 }, (_, i) => at(i / samples));
}

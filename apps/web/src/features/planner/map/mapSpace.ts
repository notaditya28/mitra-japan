import { buildJapanMap } from '../../../lib/japanMap';

/**
 * The 3D map's coordinate space. Japan is projected once into a 1000×1000
 * pixel box (same projection as every 2D map, Okinawa inset included), then
 * scaled down so the map spans ~25 world units, centred on the origin.
 * North is -z, so the default camera sits to the south looking north.
 */
const SIZE = 1000;
export const UNITS_PER_PX = 1 / 40;
export const LAND_HEIGHT = 0.35;

export const japan = buildJapanMap([
  [0, 0],
  [SIZE, SIZE],
]);

export function pxToWorld([px, py]: [number, number]): [number, number] {
  return [(px - SIZE / 2) * UNITS_PER_PX, (py - SIZE / 2) * UNITS_PER_PX];
}

/** Real-world lng/lat → world [x, z] on the map. */
export function lngLatToWorld(lng: number, lat: number): [number, number] {
  return pxToWorld(japan.project(lng, lat));
}

/** Half-extent of the map, for clamping the camera target. */
export const MAP_HALF = (SIZE / 2) * UNITS_PER_PX;

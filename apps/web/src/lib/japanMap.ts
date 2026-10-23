import { geoArea, geoContains, geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Position } from 'geojson';
import raw from '../data/japan.geojson?raw';

export interface PrefectureProps {
  id: string;
  name: string;
  nameJa: string;
}

type Prefecture = Feature<MultiPolygon, PrefectureProps>;

const source = JSON.parse(raw) as FeatureCollection<MultiPolygon, PrefectureProps>;

/**
 * Okinawa sits far to the south-west; like printed Japanese maps we draw it
 * as an inset in the empty sea to the upper left so the main islands stay
 * large. Anything south of this latitude is shifted by the same offset.
 */
const INSET_LAT = 27.9;
const INSET_SHIFT: [number, number] = [2.6, 12.2];

export function toMapLngLat(lng: number, lat: number): [number, number] {
  return lat < INSET_LAT ? [lng + INSET_SHIFT[0], lat + INSET_SHIFT[1]] : [lng, lat];
}

/** Shift a whole polygon into the inset if its rings sit mostly south of the cutoff, so no ring is ever split. */
function shiftPolygon(poly: Position[][]): Position[][] {
  const outer = poly[0] ?? [];
  const meanLat = outer.reduce((sum, [, lat = 0]) => sum + lat, 0) / Math.max(1, outer.length);
  if (meanLat >= INSET_LAT) return poly;
  return poly.map((ring) =>
    ring.map(([lng = 0, lat = 0]) => [lng + INSET_SHIFT[0], lat + INSET_SHIFT[1]]),
  );
}

/**
 * d3-geo expects clockwise exterior rings (the opposite of RFC 7946). A ring
 * with the "wrong" winding is read as the whole globe minus the shape, so any
 * polygon whose spherical area exceeds a hemisphere is reversed.
 */
function rewind(poly: Position[][]): Position[][] {
  const area = geoArea({ type: 'Polygon', coordinates: poly });
  return area > 2 * Math.PI ? poly.map((ring) => [...ring].reverse()) : poly;
}

const prefectures: Prefecture[] = source.features.map((f) => ({
  ...f,
  geometry: {
    type: 'MultiPolygon',
    coordinates: f.geometry.coordinates.map((poly) => rewind(shiftPolygon(poly))),
  },
}));

const collection: FeatureCollection<MultiPolygon, PrefectureProps> = {
  type: 'FeatureCollection',
  features: prefectures,
};

export interface ProjectedPrefecture extends PrefectureProps {
  /** Polygons → rings → [x, y] in map pixels (y grows southward). */
  polygons: [number, number][][][];
}

export interface JapanMap {
  paths: { id: string; name: string; nameJa: string; d: string }[];
  prefectures: ProjectedPrefecture[];
  /** Project real-world lng/lat (Okinawa inset applied) to map pixels. */
  project: (lng: number, lat: number) => [number, number];
  /** Frame around the Okinawa inset, in map pixels. */
  inset: { x: number; y: number; w: number; h: number };
  projection: GeoProjection;
}

/** Fit Japan into a pixel box and return SVG paths plus a projector. */
export function buildJapanMap(extent: [[number, number], [number, number]]): JapanMap {
  const projection = geoMercator().fitExtent(extent, collection);
  const path = geoPath(projection);
  const project = (lng: number, lat: number): [number, number] => {
    const p = projection(toMapLngLat(lng, lat));
    return p ? [p[0], p[1]] : [0, 0];
  };
  const [ix0, iy0] = project(122.9, 27.4);
  const [ix1, iy1] = project(129.4, 24.0);
  const toPx = ([lng = 0, lat = 0]: Position): [number, number] => {
    const p = projection([lng, lat]);
    return p ? [p[0], p[1]] : [0, 0];
  };
  return {
    paths: prefectures.map((f) => ({ ...f.properties, d: path(f) ?? '' })),
    prefectures: prefectures.map((f) => ({
      ...f.properties,
      polygons: f.geometry.coordinates.map((poly) => poly.map((ring) => ring.map(toPx))),
    })),
    project,
    inset: { x: ix0, y: iy0, w: ix1 - ix0, h: iy1 - iy0 },
    projection,
  };
}

/** ISO code (e.g. "JP-26") of the prefecture containing a real-world point, if any. */
export function prefectureAt(lng: number, lat: number): string | undefined {
  const point = toMapLngLat(lng, lat);
  return prefectures.find((f) => geoContains(f, point))?.properties.id;
}

export function prefectureName(id: string): PrefectureProps | undefined {
  return prefectures.find((f) => f.properties.id === id)?.properties;
}

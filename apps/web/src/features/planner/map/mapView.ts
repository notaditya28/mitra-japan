import { create } from 'zustand';

export type MapMode = '3d' | 'street';
/** Street map basemaps (CARTO Voyager was removed at the owner's request, 2026-10-25). */
export const BASEMAP_IDS = ['streets', 'topo', 'osm'] as const;
export type Basemap = (typeof BASEMAP_IDS)[number];

/**
 * Which map the planner shows and the street map's style. One store so the single map
 * toolbar (`MapToolbar`) drives both maps. Three-free and not persisted.
 */
export const useMapView = create<{
  mode: MapMode;
  basemap: Basemap;
  setMode: (mode: MapMode) => void;
  setBasemap: (basemap: Basemap) => void;
}>()((set) => ({
  mode: '3d',
  basemap: 'streets',
  setMode: (mode) => set({ mode }),
  setBasemap: (basemap) => set({ basemap }),
}));

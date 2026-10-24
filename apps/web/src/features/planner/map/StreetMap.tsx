import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../../store/useAppStore';
import { ANIME_SPOTS, CITIES, FOOD_SPOTS, HERITAGE_SPOTS, REGIONAL_SPOTS, cityById } from '../data';
import { usePlannerStore, visibleDays } from '../usePlannerStore';
import { LAYER_COLORS } from './layerColors';
import { useMapView, type Basemap } from './mapView';

/**
 * 2D street view of the planner (team guide 2.6): swappable basemaps (Esri streets and
 * topo, OpenStreetMap; attribution always shown) with coloured drop markers for the same
 * layers as the 3D map, plus the itinerary whenever there is one. Style and layers are set
 * from the shared `MapToolbar`. Lazy chunk. Selecting a city or a stop elsewhere moves this map too.
 */

const BASEMAPS: Record<Basemap, { url: string; attribution: string; maxZoom: number }> = {
  streets: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri and contributors',
    maxZoom: 19,
  },
  topo: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS and contributors',
    maxZoom: 19,
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};

const ROUTE_COLORS = { day: '#C2456E', stop: '#4A2238' };

/** SVG drop marker in the layer colour, optionally numbered. */
function drop(color: string, label = ''): L.DivIcon {
  const text = label
    ? `<text x="14" y="17" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="sans-serif">${label}</text>`
    : '<circle cx="14" cy="13" r="4.5" fill="#fff"/>';
  return L.divIcon({
    className: '',
    iconSize: [28, 38],
    iconAnchor: [14, 37],
    popupAnchor: [0, -32],
    html: `<svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true"><path d="M14 37s12-13.4 12-23A12 12 0 0 0 2 14c0 9.6 12 23 12 23z" fill="${color}" stroke="#fff" stroke-width="2"/>${text}</svg>`,
  });
}

function popup(title: string, lines: string[]): HTMLElement {
  const el = document.createElement('div');
  const h = document.createElement('strong');
  h.textContent = title;
  el.append(h);
  for (const line of lines.filter(Boolean)) {
    const p = document.createElement('div');
    p.style.fontSize = '11px';
    p.textContent = line;
    el.append(p);
  }
  return el;
}

export default function StreetMap() {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const group = useRef<L.LayerGroup | null>(null);
  const basemap = useMapView((s) => s.basemap);
  const layers = useAppStore((s) => s.layers);
  const [tilesFailed, setTilesFailed] = useState(false);
  const diet = useAppStore((s) => s.diet);
  const selectedCityId = useAppStore((s) => s.selectedCityId);
  const itinerary = usePlannerStore((s) => s.itinerary);
  const previews = usePlannerStore((s) => s.previews);
  const focusedStop = usePlannerStore((s) => s.focusedStop);
  const focusCity = usePlannerStore((s) => s.focusCity);
  const days = useMemo(() => visibleDays({ itinerary, previews }), [itinerary, previews]);

  useEffect(() => {
    if (!box.current) return;
    // Zoom buttons go bottom right: the map toolbar owns the top left.
    const m = L.map(box.current, { zoomControl: false }).setView([36.2, 137.5], 5);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    group.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    tiles.current?.remove();
    const b = BASEMAPS[basemap];
    let errors = 0;
    setTilesFailed(false);
    tiles.current = L.tileLayer(b.url, {
      attribution: b.attribution,
      maxZoom: b.maxZoom,
    })
      .on('tileerror', () => {
        errors += 1;
        if (errors > 3) setTilesFailed(true);
      })
      .on('tileload', () => setTilesFailed(false))
      .addTo(m);
  }, [basemap]);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.clearLayers();
    if (layers.vegSafe) {
      for (const f of FOOD_SPOTS) {
        if (diet !== 'none' && !f.dietOptions.some((o) => o.diet === diet)) continue;
        L.marker([f.lat, f.lng], { icon: drop(LAYER_COLORS.vegSafe), title: f.name })
          .bindPopup(
            popup(f.name, [
              `${f.cuisine} · ${f.area}`,
              t(f.status === 'sample' ? 'status.sample' : 'status.needsReview'),
            ]),
          )
          .addTo(g);
      }
    }
    if (layers.heritage) {
      for (const h of HERITAGE_SPOTS) {
        L.marker([h.lat, h.lng], { icon: drop(LAYER_COLORS.heritage), title: h.japanese })
          .bindPopup(popup(h.japanese, [h.place, t('status.needsReview')]))
          .addTo(g);
      }
    }
    for (const [layer, spots] of [
      ['anime', ANIME_SPOTS],
      ['regional', REGIONAL_SPOTS],
    ] as const) {
      if (!layers[layer]) continue;
      for (const a of spots) {
        L.marker([a.lat, a.lng], { icon: drop(LAYER_COLORS[layer]), title: a.name })
          .bindPopup(popup(a.name, [a.note]))
          .addTo(g);
      }
    }
    if (days.length > 0) {
      const route: L.LatLngExpression[] = [];
      for (const d of days) {
        const c = cityById(d.cityId);
        if (!c) continue;
        route.push([c.lat, c.lng]);
        L.marker([c.lat, c.lng], { icon: drop(ROUTE_COLORS.day, String(d.day)), title: d.title })
          .bindPopup(popup(`${t('trip.day', { n: d.day })} · ${c.name}`, [d.title]))
          .on('click', () => focusCity(d.cityId))
          .addTo(g);
        d.stops.forEach((s) => {
          if (s.lat === null || s.lng === null) return;
          L.marker([s.lat, s.lng], { icon: drop(ROUTE_COLORS.stop), title: s.name })
            .bindPopup(popup(s.name, [t(`trip.slots.${s.slot}`), s.note]))
            .addTo(g);
        });
      }
      if (route.length > 1)
        L.polyline(route, { color: '#F0C27B', weight: 4, opacity: 0.9, dashArray: '8 6' }).addTo(g);
    }
  }, [layers, diet, days, t, focusCity]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (focusedStop) m.flyTo([focusedStop.lat, focusedStop.lng], 15, { duration: 1 });
    else {
      const c = selectedCityId ? cityById(selectedCityId) : undefined;
      if (c) m.flyTo([c.lat, c.lng], 12, { duration: 1 });
    }
  }, [selectedCityId, focusedStop]);

  return (
    // `isolate` keeps Leaflet's z-indexed panes below the map toolbar.
    <div className="absolute inset-0 isolate flex flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={box}
          role="region"
          aria-label={t('streetMap.label')}
          className="absolute inset-0"
        />
        {tilesFailed ? (
          <p className="absolute inset-x-3 bottom-3 z-[500] rounded-lg bg-paper/95 px-3 py-2 text-xs text-plum shadow-soft">
            {t('tour.map.offline')}
          </p>
        ) : null}
      </div>
      <p className="sr-only">{t('streetMap.cities', { count: CITIES.length })}</p>
    </div>
  );
}

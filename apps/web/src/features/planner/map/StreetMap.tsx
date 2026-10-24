import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../../store/useAppStore';
import { CITIES, FOOD_SPOTS, HERITAGE_SPOTS, cityById } from '../data';
import { usePlannerStore, visibleDays } from '../usePlannerStore';

/**
 * 2D street view of the planner (team guide 2.6): hot-swappable basemaps (Esri streets
 * and topo, OpenStreetMap, CARTO Voyager; attribution always shown) and layer filters for
 * food places, heritage sites and itinerary waypoints, with coloured drop markers.
 * Lazy chunk. Selecting a city or a stop elsewhere moves this map too.
 */

type Basemap = 'streets' | 'topo' | 'osm' | 'carto';
type Layer = 'food' | 'heritage' | 'itinerary';

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
  carto: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
    maxZoom: 20,
  },
};

const COLORS: Record<Layer | 'stop', string> = {
  food: '#8FD19E',
  heritage: '#F0C27B',
  itinerary: '#C2456E',
  stop: '#4A2238',
};

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
  const [basemap, setBasemap] = useState<Basemap>('streets');
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    food: true,
    heritage: true,
    itinerary: true,
  });
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
    const m = L.map(box.current, { zoomControl: true }).setView([36.2, 137.5], 5);
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
      subdomains: 'abcd',
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
    if (layers.food) {
      for (const f of FOOD_SPOTS) {
        if (diet !== 'none' && !f.dietOptions.some((o) => o.diet === diet)) continue;
        L.marker([f.lat, f.lng], { icon: drop(COLORS.food), title: f.name })
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
        L.marker([h.lat, h.lng], { icon: drop(COLORS.heritage), title: h.japanese })
          .bindPopup(popup(h.japanese, [h.place, t('status.needsReview')]))
          .addTo(g);
      }
    }
    if (layers.itinerary && days.length > 0) {
      const route: L.LatLngExpression[] = [];
      for (const d of days) {
        const c = cityById(d.cityId);
        if (!c) continue;
        route.push([c.lat, c.lng]);
        L.marker([c.lat, c.lng], { icon: drop(COLORS.itinerary, String(d.day)), title: d.title })
          .bindPopup(popup(`${t('trip.day', { n: d.day })} · ${c.name}`, [d.title]))
          .on('click', () => focusCity(d.cityId))
          .addTo(g);
        d.stops.forEach((s) => {
          if (s.lat === null || s.lng === null) return;
          L.marker([s.lat, s.lng], { icon: drop(COLORS.stop), title: s.name })
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
    <div className="absolute inset-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-plum px-3 py-2 text-xs text-paper">
        <label className="flex items-center gap-1.5">
          <span className="font-semibold">{t('streetMap.basemap')}</span>
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as Basemap)}
            className="rounded-lg border border-white/20 bg-plum px-2 py-1 text-paper focus:outline focus:outline-2 focus:outline-gold"
          >
            {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
              <option key={b} value={b}>
                {t(`streetMap.basemaps.${b}`)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">{t('streetMap.layers')}</legend>
          {(Object.keys(layers) as Layer[]).map((l) => (
            <label
              key={l}
              className={`flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-gold ${
                layers[l] ? 'bg-paper text-plum' : 'bg-white/10 text-paper/80'
              }`}
            >
              <input
                type="checkbox"
                checked={layers[l]}
                onChange={() => setLayers((s) => ({ ...s, [l]: !s[l] }))}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[l] }}
              />
              {t(`streetMap.layerNames.${l}`)}
            </label>
          ))}
        </fieldset>
      </div>
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

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityLite } from './cities';
import type { FoodPin, Stay } from './cityMap';
import { cityName, spotName } from './labels';
import type { Spot } from './tour';

// Esri's light grey canvas without its label layer (those labels are Japanese +
// romaji in Japan): a quiet base so the pins stand out. We label the places ourselves,
// in the chosen language.
const TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const MAX_ZOOM = 16;
const ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

/** Pins with a dark plum outline, so they read on the light grey map. */
const pin = (fill: string, radius = 8): L.CircleMarkerOptions => ({
  radius,
  color: '#4A2238',
  weight: 2.5,
  fillColor: fill,
  fillOpacity: 1,
});

/** Popup content built from DOM nodes, never HTML strings, so data can't inject markup. */
function popup(title: string, lines: string[]): HTMLElement {
  const el = document.createElement('div');
  const h = document.createElement('strong');
  h.textContent = title;
  el.append(h);
  for (const line of lines) {
    const p = document.createElement('div');
    p.textContent = line;
    p.style.fontSize = '11px';
    el.append(p);
  }
  return el;
}

/**
 * The street map inside the city window: Esri's plain light grey canvas (attribution
 * shown), green pins for food, gold for stays and a labelled rose pin for where you
 * are, all outlined in plum. Labels and popups come from our data, so they follow
 * the chosen language instead of the map's.
 * Lazy chunk. If tiles fail (offline) the markers stay and a note says why.
 */
export default function CityLeaflet({
  city,
  food,
  stays,
  here,
}: {
  city: CityLite;
  food: FoodPin[];
  stays: Stay[];
  here: Spot | null;
}) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true });
    let errors = 0;
    L.tileLayer(TILES, { maxZoom: MAX_ZOOM, attribution: ATTRIBUTION })
      .on('tileerror', () => {
        errors += 1;
        if (errors > 3) setTilesFailed(true);
      })
      .on('tileload', () => setTilesFailed(false))
      .addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const points: L.LatLngExpression[] = [[city.lat, city.lng]];

    for (const { restaurant: r, option } of food) {
      points.push([r.lat, r.lng]);
      L.circleMarker([r.lat, r.lng], pin('#8FD19E'))
        .bindPopup(
          popup(
            r.name,
            [
              `${r.cuisine} · ${r.area}`,
              t(r.status === 'sample' ? 'status.sample' : 'status.needsReview'),
              option
                ? `${t(`diets.${option.diet}`)}: ${t(`restaurants.basis.${option.basis}`)}`
                : '',
              r.coordinatePrecision !== 'exact'
                ? t(`restaurants.precision.${r.coordinatePrecision}`, { defaultValue: '' })
                : '',
            ].filter(Boolean),
          ),
        )
        .addTo(g);
    }
    for (const s of stays) {
      points.push([s.lat, s.lng]);
      L.circleMarker([s.lat, s.lng], pin('#F0C27B'))
        .bindPopup(
          popup(s.name, [`${t(`tour.map.kinds.${s.kind}`)} · ${s.area}`, t('tour.map.sampleStay')]),
        )
        .addTo(g);
    }
    if (here) {
      points.push([here.lat, here.lng]);
      const name = spotName(t, here);
      L.circleMarker([here.lat, here.lng], pin('#C2456E', 10))
        .bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -10] })
        .bindPopup(popup(name, [t('tour.map.youAreHere'), t('tour.map.approximate')]))
        .addTo(g);
    }
    m.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 14 });
  }, [city, food, stays, here, t]);

  return (
    <div className="absolute inset-0">
      <div
        ref={box}
        role="region"
        aria-label={t('tour.map.title', { city: cityName(t, city.id, city.name) })}
        className="h-full w-full"
      />
      {tilesFailed ? (
        <p className="absolute inset-x-2 bottom-2 z-[500] rounded-lg bg-paper/95 px-2 py-1 text-[11px] text-plum shadow-soft">
          {t('tour.map.offline')}
        </p>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityLite } from './cities';
import type { FoodPin, Stay } from './cityMap';
import type { Spot } from './tour';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

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
 * The street map inside the city window: OpenStreetMap tiles (free, attribution
 * shown), matcha dots for food, gold for stays, a rose ring for where you are.
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
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION })
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
      L.circleMarker([r.lat, r.lng], {
        radius: 7,
        color: '#FFF8FA',
        weight: 2,
        fillColor: '#8FD19E',
        fillOpacity: 1,
      })
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
      L.circleMarker([s.lat, s.lng], {
        radius: 7,
        color: '#FFF8FA',
        weight: 2,
        fillColor: '#F0C27B',
        fillOpacity: 1,
      })
        .bindPopup(
          popup(s.name, [`${t(`tour.map.kinds.${s.kind}`)} · ${s.area}`, t('tour.map.sampleStay')]),
        )
        .addTo(g);
    }
    if (here) {
      points.push([here.lat, here.lng]);
      L.circleMarker([here.lat, here.lng], {
        radius: 9,
        color: '#C2456E',
        weight: 3,
        fillColor: '#FFF8FA',
        fillOpacity: 0.9,
      })
        .bindPopup(popup(here.name, [t('tour.map.youAreHere'), t('tour.map.approximate')]))
        .addTo(g);
    }
    m.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 14 });
  }, [city, food, stays, here, t]);

  return (
    <div className="absolute inset-0">
      <div
        ref={box}
        role="region"
        aria-label={t('tour.map.title', { city: city.name })}
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

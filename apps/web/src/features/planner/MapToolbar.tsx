import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayerToggles } from './LayerToggles';
import { BASEMAP_IDS, useMapView, type Basemap } from './map/mapView';

const PILL =
  'rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold';

/**
 * One toolbar for both maps (owner request, 2026-10-25): 3D map | Street map, and a single
 * Map layers button next to it. It stays in the same top-left place on both maps, so the
 * way back to 3D is always visible. The street map's style picker sits in the layers panel.
 */
export function MapToolbar() {
  const { t } = useTranslation();
  const mode = useMapView((s) => s.mode);
  const setMode = useMapView((s) => s.setMode);
  const basemap = useMapView((s) => s.basemap);
  const setBasemap = useMapView((s) => s.setBasemap);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    // The street map is `isolate`d, so a low z-index clears Leaflet and stays under pop-ups.
    <div ref={root} className="absolute left-3 top-3 z-20 flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t('streetMap.toggle')}
          className="flex gap-1 rounded-full bg-plum/85 p-1 shadow-lift backdrop-blur-sm"
        >
          {(['3d', 'street'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`${PILL} ${mode === m ? 'bg-paper text-plum' : 'text-paper/80 hover:text-paper'}`}
            >
              {t(`streetMap.modes.${m}`)}
            </button>
          ))}
        </div>
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 shadow-lift backdrop-blur-sm ${PILL} !py-2 ${
            open ? 'bg-paper text-plum' : 'bg-plum/85 text-paper hover:bg-plum'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          {t('sections.layers')}
        </button>
      </div>

      {open ? (
        <div
          id={panelId}
          data-lenis-prevent
          className="max-h-[min(70vh,520px)] w-[min(calc(100vw-1.5rem),320px)] overflow-y-auto rounded-2xl border border-blush bg-paper p-3 text-ink shadow-lift"
        >
          <LayerToggles />
          {mode === 'street' ? (
            <label className="mt-3 flex items-center justify-between gap-2 text-sm text-plum">
              <span className="font-semibold">{t('streetMap.basemap')}</span>
              <select
                value={basemap}
                onChange={(e) => setBasemap(e.target.value as Basemap)}
                className="rounded-lg border border-petal bg-white px-2 py-1 text-sm focus:outline focus:outline-2 focus:outline-rose"
              >
                {BASEMAP_IDS.map((b) => (
                  <option key={b} value={b}>
                    {t(`streetMap.basemaps.${b}`)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="mt-3 text-[11px] text-mist">{t('streetMap.layersNote')}</p>
        </div>
      ) : null}
    </div>
  );
}

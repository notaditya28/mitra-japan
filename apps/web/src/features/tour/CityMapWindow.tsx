import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cityLite } from './cities';
import { mapCityFor, SEGMENTS } from './tour';
import { useTourStore } from './useTourStore';

const CityMapPanel = lazy(() => import('./CityMapPanel'));

/**
 * Top-right window on the journey: a small bar that expands into a map of the city
 * you are in, with food that suits your diet and (sample) places to stay. It follows
 * the journey from city to city; the diet choice is the profile's, so it carries over.
 */
export function CityMapWindow() {
  const { t } = useTranslation();
  const panelId = useId();
  const segment = useTourStore((s) => s.segment);
  const [open, setOpen] = useState(false);
  const [journeyVisible, setJourneyVisible] = useState(true);
  const cityId = mapCityFor(SEGMENTS, segment);
  const city = cityId ? cityLite(cityId) : undefined;
  const seg = SEGMENTS[segment];
  const here = seg?.kind === 'spot' ? seg.spot : null;

  useEffect(() => {
    const el = document.getElementById('journey');
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setJourneyVisible(e?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!city || !journeyVisible) return null;

  return (
    <div className="fixed right-3 top-[calc(var(--nav-h,61px)+10px)] z-30 flex flex-col items-end sm:right-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-white/40 bg-plum/85 px-3.5 py-2 text-sm font-semibold text-paper shadow-lift backdrop-blur-md transition hover:bg-plum focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        <span lang="ja" className="font-display">
          {city.nameJa}
        </span>
        {t('tour.map.open', { city: city.name })}
        <span aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {open ? (
        <Suspense
          fallback={
            <p className="mt-2 rounded-card bg-paper px-4 py-3 text-xs text-mist shadow-lift">
              {t('tour.map.loading')}
            </p>
          }
        >
          <CityMapPanel panelId={panelId} city={city} here={here} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}

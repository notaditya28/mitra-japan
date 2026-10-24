import { lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../../components/sections/SectionHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { FROM, SEGMENTS, TOUR_CITIES } from './tour';
import { useTourStore } from './useTourStore';

const FlightMapSvg = lazy(() => import('./FlightMapSvg'));

/**
 * The journey without scroll-driven 3D (reduced motion, low-end devices, no WebGL):
 * a flat flight map, then each city's spots in order (the 3D scenes need WebGL). The city map window follows
 * whichever city is in view.
 */
export function TourStatic() {
  const { t } = useTranslation();
  const setSegment = useTourStore((s) => s.setSegment);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).dataset.city;
          const i = SEGMENTS.findIndex((s) => s.kind === 'spot' && s.cityId === id);
          if (i >= 0) setSegment(i);
        }
      },
      { rootMargin: '-40% 0px -40% 0px' },
    );
    el.querySelectorAll('[data-city]').forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [setSegment]);

  const first = TOUR_CITIES[0];

  return (
    <section ref={root} id="tour" aria-labelledby="tour-title" className="bg-plum text-paper">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
        <SectionHeader
          id="tour-title"
          dark
          eyebrow={t('tour.title')}
          title={t('tour.flight.title', { from: FROM.name, to: first?.name ?? '' })}
          body={t('tour.flight.body')}
        />
        <div className="overflow-hidden rounded-card border border-white/10">
          <Suspense fallback={<div className="aspect-[16/9] bg-plum" />}>
            <FlightMapSvg
              title={t('tour.flight.title', { from: FROM.name, to: first?.name ?? '' })}
            />
          </Suspense>
        </div>

        {TOUR_CITIES.map((city, ci) => (
          <div key={city.id} id={`tour-city-${city.id}`} data-city={city.id} className="mt-20">
            {ci > 0 ? (
              <p className="mb-6 text-center text-sm text-blush/85">
                <span lang="ja" className="mr-2 font-display text-gold">
                  新幹線
                </span>
                {t('tour.train.title', { city: city.name })}
              </p>
            ) : null}
            <h3 className="display text-4xl text-paper">
              <span lang="ja" className="mr-3 font-display text-gold">
                {city.nameJa}
              </span>
              {city.name}
            </h3>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {city.spots.map((s) => (
                <article key={s.id} className="overflow-hidden rounded-card bg-plum/60">
                  <div
                    aria-hidden="true"
                    className="grid aspect-[16/9] place-items-center bg-gradient-to-b from-[#2E1424] to-plum"
                  >
                    <span lang="ja" className="font-display text-6xl text-gold/90">
                      {s.kanji}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                    <span lang="ja" className="font-display text-gold">
                      {s.nameJa}
                    </span>
                    <h4 className="font-semibold">{s.name}</h4>
                    <StatusBadge status={s.status} />
                    <span className="w-full text-[11px] text-blush/75">{s.area}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

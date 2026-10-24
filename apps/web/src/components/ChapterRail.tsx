import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cityLite as cityById } from '../features/tour/cities';
import { cityName, spotName } from '../features/tour/labels';
import { goToSegment } from '../features/tour/navigate';
import { SEGMENTS, TOUR_CITIES } from '../features/tour/tour';
import { useTourStore } from '../features/tour/useTourStore';

/**
 * The journey rail (right edge, desktop): the flight, then each city with its spots
 * (only the current city's spots are expanded) and the Shinkansen between cities,
 * in the chosen language. Any entry jumps straight there.
 */
export function ChapterRail() {
  const { t } = useTranslation();
  const active = useTourStore((s) => s.segment);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Shown once the tour starts, so it never sits over the traveller picker.
    const el = document.getElementById('tour');
    const io = el
      ? new IntersectionObserver(([e]) => setVisible(e?.isIntersecting ?? true), {
          rootMargin: '-30% 0px -30% 0px',
        })
      : null;
    if (el) io?.observe(el);
    return () => io?.disconnect();
  }, []);

  const activeCity = SEGMENTS[active]?.cityId;
  const firstOf = (cityId: string) =>
    SEGMENTS.findIndex((s) => s.kind === 'spot' && s.cityId === cityId);

  const item = (key: string, i: number, label: string, level: 0 | 1) => {
    const on = i === active;
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => goToSegment(i)}
          aria-current={on ? 'step' : undefined}
          className={`group flex flex-row-reverse items-center gap-3 rounded-full py-1 pl-3 text-right font-semibold transition-all duration-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
            level === 0 ? 'text-xs' : 'text-[11px]'
          } ${on ? 'text-paper' : 'text-paper/55 hover:text-paper/90'}`}
        >
          <span
            aria-hidden="true"
            className={`h-px transition-all duration-500 ${on ? 'w-8 bg-gold' : level === 0 ? 'w-4 bg-paper/50' : 'w-2 bg-paper/40'}`}
          />
          <span className={level === 0 ? 'text-sm' : 'text-xs'}>{label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav
      aria-label={t('tour.rail')}
      data-lenis-prevent
      className={`fixed right-5 top-1/2 z-30 hidden max-h-[80vh] -translate-y-1/2 overflow-y-auto transition-opacity duration-500 lg:block ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <ol className="flex flex-col items-end gap-1.5 [text-shadow:0_1px_12px_rgb(46_20_36/0.7)]">
        {item('flight', 0, t('tour.flight.rail'), 0)}
        {TOUR_CITIES.map((city) => {
          const first = firstOf(city.id);
          const train = SEGMENTS.findIndex((s) => s.kind === 'train' && s.cityId === city.id);
          const open = activeCity === city.id;
          return [
            train > 0 ? item(`train-${city.id}`, train, t('tour.train.rail'), 0) : null,
            item(
              `city-${city.id}`,
              first,
              cityName(t, city.id, cityById(city.id)?.name ?? city.name),
              0,
            ),
            open
              ? SEGMENTS.map((s, i) =>
                  s.kind === 'spot' && s.cityId === city.id
                    ? item(`spot-${i}`, i, spotName(t, s.spot), 1)
                    : null,
                )
              : null,
          ];
        })}
      </ol>
    </nav>
  );
}

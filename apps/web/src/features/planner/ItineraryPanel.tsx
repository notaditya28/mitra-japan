import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../components/StatusBadge';
import { TripActions } from '../trips/TripActions';
import { DayCard } from './DayCard';
import { usePlannerStore, visibleDays } from './usePlannerStore';

const MOFA_VISA = 'https://www.mofa.go.jp/j_info/visit/visa/index.html';
const EMBASSY_INDIA = 'https://www.in.emb-japan.go.jp/';

/** The day-by-day plan. Streams in day cards as the guide writes them. */
export function ItineraryPanel({ onShowCity }: { onShowCity: (cityId: string) => void }) {
  const { t } = useTranslation();
  const itinerary = usePlannerStore((s) => s.itinerary);
  const previews = usePlannerStore((s) => s.previews);
  const selectedDay = usePlannerStore((s) => s.selectedDay);
  const focusDay = usePlannerStore((s) => s.focusDay);
  const days = visibleDays({ itinerary, previews });
  const cards = useRef<Record<number, HTMLElement | null>>({});
  /** Day tabs (team guide 2.4): one day at a time, or all of them. */
  const [view, setView] = useState<'all' | number>('all');
  const shown = view === 'all' ? days : days.filter((d) => d.day === view);

  // Following the map: a day picked there becomes the open tab.
  useEffect(() => {
    if (selectedDay !== null) setView((v) => (v === 'all' ? v : selectedDay));
  }, [selectedDay]);
  // A shorter new plan can't keep a tab that no longer exists.
  useEffect(() => {
    if (view !== 'all' && !days.some((d) => d.day === view)) setView('all');
  }, [days, view]);

  // Selecting a marker on the map scrolls its day card into view.
  useEffect(() => {
    if (selectedDay === null) return;
    cards.current[selectedDay]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedDay]);

  if (days.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <p className="font-display text-2xl text-plum">{t('trip.empty')}</p>
        <p className="text-sm text-mist">{t('trip.emptyHint')}</p>
      </div>
    );
  }

  return (
    <section
      id="itinerary"
      aria-labelledby="trip-title"
      className="flex scroll-mt-2 flex-col gap-4"
    >
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="trip-title" className="display text-3xl text-plum">
            {t('trip.title')}
          </h2>
          {itinerary ? (
            itinerary.source === 'sample' ? (
              <StatusBadge status="sample" />
            ) : (
              <span className="rounded-full bg-plum px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-paper">
                {t('trip.liveBadge')}
              </span>
            )
          ) : null}
        </div>
        {itinerary ? <p className="mt-2 text-sm text-ink">{itinerary.summary}</p> : null}
      </header>

      {itinerary ? <TripActions itinerary={itinerary} /> : null}

      {itinerary && itinerary.notices.length > 0 ? (
        <div
          role="status"
          className="rounded-2xl border border-gold/60 bg-gold/15 p-3 text-xs text-plum"
        >
          <p className="font-semibold">{t('trip.notices')}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {itinerary.notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {days.length > 1 ? (
        <div
          role="tablist"
          aria-label={t('trip.dayTabs')}
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
        >
          {(['all', ...days.map((d) => d.day)] as const).map((k) => {
            const on = view === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setView(k);
                  if (k !== 'all') focusDay(k);
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  on ? 'bg-plum text-paper' : 'bg-blush text-plum hover:bg-petal'
                }`}
              >
                {k === 'all' ? t('trip.allDays') : t('trip.day', { n: k })}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {shown.map((d) => (
          <DayCard
            key={d.day}
            ref={(el) => {
              cards.current[d.day] = el;
            }}
            day={d}
            selected={d.day === selectedDay}
            preview={!itinerary}
            onShowCity={onShowCity}
          />
        ))}
      </div>

      {itinerary ? (
        <div className="space-y-4 text-sm">
          {itinerary.bestSeason ? (
            <section>
              <h3 className="font-display text-lg text-plum">{t('trip.seasonTitle')}</h3>
              <p className="text-ink">{itinerary.bestSeason}</p>
            </section>
          ) : null}
          {itinerary.etiquetteTips.length > 0 ? (
            <section>
              <h3 className="font-display text-lg text-plum">{t('trip.etiquetteTitle')}</h3>
              <ul className="list-disc space-y-0.5 pl-4 text-ink">
                {itinerary.etiquetteTips.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {itinerary.visaChecklist.length > 0 ? (
            <section className="rounded-2xl border border-blush bg-white/70 p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg text-plum">{t('trip.visaTitle')}</h3>
                <StatusBadge status="needs-review" />
              </div>
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-ink">
                {itinerary.visaChecklist.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-mist">{t('trip.visaNote')}</p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                <a
                  href={MOFA_VISA}
                  target="_blank"
                  rel="noreferrer"
                  className="text-rose underline underline-offset-2"
                >
                  {t('trip.visaMofa')}
                </a>
                <a
                  href={EMBASSY_INDIA}
                  target="_blank"
                  rel="noreferrer"
                  className="text-rose underline underline-offset-2"
                >
                  {t('trip.visaEmbassy')}
                </a>
              </p>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

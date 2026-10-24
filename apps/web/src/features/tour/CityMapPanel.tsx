import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { DietChips } from '../../components/DietChips';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore, type Diet } from '../../store/useAppStore';
import type { CityLite } from './cities';
import { foodFor, staysFor } from './cityMap';
import { cityName } from './labels';
import type { Spot } from './tour';

const CityLeaflet = lazy(() => import('./CityLeaflet'));

const DIETS: Diet[] = ['vegetarian', 'jain', 'vegan', 'halal', 'no-beef', 'eggless', 'none'];

/**
 * The expanded city window: diet picker, street map and the lists of food and
 * (sample) stays. Lazy chunk, so first paint carries no restaurant data or Leaflet.
 */
export default function CityMapPanel({
  panelId,
  city,
  here,
  onClose,
}: {
  panelId: string;
  city: CityLite;
  here: Spot | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const food = foodFor(city.id, diet);
  const stays = staysFor(city.id);

  return (
    <section
      id={panelId}
      aria-label={t('tour.map.title', { city: cityName(t, city.id, city.name) })}
      data-lenis-prevent
      className="mt-2 flex max-h-[calc(100svh-140px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-card border border-blush bg-paper text-ink shadow-lift"
    >
      <div className="space-y-2 border-b border-blush px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-plum">
            {t('tour.map.title', { city: cityName(t, city.id, city.name) })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('planner.close')}
            className="grid h-8 w-8 place-items-center rounded-full bg-blush text-plum hover:bg-petal"
          >
            ×
          </button>
        </div>
        <p className="text-xs font-semibold text-plum">{t('tour.map.diet')}</p>
        <DietChips diets={DIETS} />
      </div>

      <div className="relative h-56 shrink-0 bg-blush sm:h-64">
        <Suspense fallback={<p className="p-4 text-xs text-mist">{t('tour.map.loading')}</p>}>
          <CityLeaflet city={city} food={food} stays={stays} here={here} />
        </Suspense>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-plum">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-matcha ring-2 ring-plum"
          />
          {t('tour.map.food', { diet: t(`diets.${diet}`) })}
        </h3>
        {food.length === 0 ? (
          <p className="mt-1 text-xs text-mist">{t('tour.map.noFood')}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {food.map(({ restaurant: r, option }) => (
              <li key={r.id} className="rounded-xl bg-blush/50 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-plum">{r.name}</p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-xs text-mist">
                  {r.cuisine} · {r.area}
                </p>
                {option ? (
                  <p className="text-xs text-ink">
                    {t(`diets.${option.diet}`)}: {t(`restaurants.basis.${option.basis}`)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-plum">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-plum" />
          {t('tour.map.stays')}
        </h3>
        <p className="mt-1 text-xs text-mist">{t('tour.map.staysNote')}</p>
        <ul className="mt-2 space-y-2">
          {stays.map((s) => (
            <li key={s.id} className="rounded-xl bg-gold/15 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-plum">{s.name}</p>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-xs text-mist">
                {t(`tour.map.kinds.${s.kind}`)} · {s.area}
              </p>
              <p className="text-xs text-ink">{s.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-mist">{t('tour.map.footnote')}</p>
      </div>
    </section>
  );
}

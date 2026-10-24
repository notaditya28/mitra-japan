import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore, type Diet } from '../../store/useAppStore';
import { CITIES, RESTAURANTS, cityById, type Restaurant } from '../planner/data';
import { usePlannerStore } from '../planner/usePlannerStore';
import { useTools } from '../tools/useTools';
import { DEFAULT_FILTERS, filterRestaurants, type DirectoryFilters, type Show } from './directory';
import { ShojinGuide } from './ShojinGuide';

const DIETS: Diet[] = ['jain', 'vegetarian', 'vegan', 'halal', 'no-beef', 'eggless'];

const BASIS_STYLE = {
  'independently-verified': 'bg-matcha/35 text-plum',
  'self-reported': 'bg-blush text-plum',
  'third-party': 'bg-blush text-plum',
  unconfirmed: 'bg-mist/10 text-mist',
} as const;

const FIELD =
  'mt-1 w-full rounded-xl border border-petal bg-paper px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/40';

function RestaurantCard({ r, diet }: { r: Restaurant; diet: Diet | 'any' }) {
  const { t } = useTranslation();
  const focusCity = usePlannerStore((s) => s.focusCity);
  const layers = useAppStore((s) => s.layers);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const close = useTools((s) => s.close);
  const city = cityById(r.cityId);
  const sample = r.status === 'sample';

  const showOnMap = () => {
    if (!layers.vegSafe) toggleLayer('vegSafe');
    focusCity(r.cityId);
    close();
  };

  return (
    <li className="rounded-2xl border border-blush bg-white/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-plum">
            {r.name}
            {r.nameJa && r.nameJa !== r.name ? (
              <span lang="ja" className="ml-2 text-sm font-normal text-mist">
                {r.nameJa}
              </span>
            ) : null}
          </h3>
          <p className="text-xs text-mist">
            {r.cuisine} · {city?.name} · {r.area}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <p className="mt-2 text-xs text-ink">{sample ? t('restaurants.sampleAddress') : r.address}</p>

      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('restaurants.dietOptions')}>
        {r.dietOptions.map((o) => (
          <li
            key={o.diet}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BASIS_STYLE[o.basis]} ${
              o.diet === diet ? 'ring-2 ring-rose/60' : ''
            }`}
          >
            {t(`diets.${o.diet}`)} · {t(`restaurants.basis.${o.basis}`)}
          </li>
        ))}
      </ul>

      {r.nearestStation ||
      r.priceRange ||
      r.englishMenu !== undefined ||
      r.dedicatedCookware !== undefined ? (
        <ul className="mt-2 space-y-0.5 text-xs text-ink">
          {r.nearestStation ? (
            <li>
              {t('restaurants.station')}: {r.nearestStation}
              {r.stationGuidance ? ` (${r.stationGuidance})` : ''}
            </li>
          ) : null}
          {r.priceRange ? (
            <li>
              {t('restaurants.price')}: {r.priceRange}
            </li>
          ) : null}
          {r.englishMenu !== undefined && r.englishMenu !== null ? (
            <li>
              {t(r.englishMenu ? 'restaurants.englishMenu.yes' : 'restaurants.englishMenu.no')}
            </li>
          ) : null}
          {r.dedicatedCookware !== undefined && r.dedicatedCookware !== null ? (
            <li>
              {t(r.dedicatedCookware ? 'restaurants.cookware.yes' : 'restaurants.cookware.no')}
            </li>
          ) : null}
        </ul>
      ) : null}

      {r.risks.length > 0 ? (
        <p className="mt-2 text-xs text-plum">
          {t('planner.check')}: {r.risks.map((k) => t(`planner.risks.${k}`)).join(', ')}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-ink">{r.note}</p>

      {r.dietOptions.some((o) => o.evidence) || !sample ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-semibold text-rose">
            {t('restaurants.evidence')}
          </summary>
          <div className="mt-2 space-y-1 text-ink">
            {[...new Set(r.dietOptions.map((o) => o.evidence).filter(Boolean))].map((e) => (
              <p key={e}>{e}</p>
            ))}
            <p className="text-mist">
              {t('restaurants.source')}: {r.source}
            </p>
            {r.lastChecked ? (
              <p className="text-mist">{t('restaurants.lastChecked', { date: r.lastChecked })}</p>
            ) : null}
            {r.coordinatePrecision !== 'exact' ? (
              <p className="text-mist">{t(`restaurants.precision.${r.coordinatePrecision}`)}</p>
            ) : null}
          </div>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={showOnMap}
          className="rounded-full bg-blush px-3 py-1.5 text-xs font-semibold text-plum hover:bg-petal"
        >
          {t('restaurants.showOnMap')}
        </button>
        {r.link ? (
          <a
            href={r.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-rose underline-offset-4 hover:underline"
          >
            {t('restaurants.openSource')}
            <span className="sr-only"> ({t('restaurants.newTab')})</span>
          </a>
        ) : null}
      </div>
    </li>
  );
}

/** Searchable directory of veg-friendly places: researched (needs review) and illustrative samples. */
export default function RestaurantDirectory() {
  const { t } = useTranslation();
  const id = useId();
  const startCity = useTools((s) => s.eatCity);
  const diet = useAppStore((s) => s.diet);
  const [filters, setFilters] = useState<DirectoryFilters>({
    ...DEFAULT_FILTERS,
    cityId: startCity ?? 'all',
    diet: diet === 'none' ? 'any' : diet,
  });
  const set = (p: Partial<DirectoryFilters>) => setFilters((f) => ({ ...f, ...p }));
  const results = useMemo(() => filterRestaurants(RESTAURANTS, filters), [filters]);
  const listed = RESTAURANTS.filter((r) => r.status !== 'sample').length;

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-2xl bg-blush/60 px-4 py-3 text-sm text-plum">
        {t('restaurants.intro', { listed, samples: RESTAURANTS.length - listed })}
      </p>
      <ShojinGuide />

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-q`} className="text-xs font-semibold text-plum">
            {t('restaurants.search')}
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder={t('restaurants.searchPlaceholder')}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor={`${id}-city`} className="text-xs font-semibold text-plum">
            {t('restaurants.city')}
          </label>
          <select
            id={`${id}-city`}
            value={filters.cityId}
            onChange={(e) => set({ cityId: e.target.value })}
            className={FIELD}
          >
            <option value="all">{t('restaurants.allCities')}</option>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-diet`} className="text-xs font-semibold text-plum">
            {t('diets.label')}
          </label>
          <select
            id={`${id}-diet`}
            value={filters.diet}
            onChange={(e) => set({ diet: e.target.value as Diet | 'any' })}
            className={FIELD}
          >
            <option value="any">{t('restaurants.anyDiet')}</option>
            {DIETS.map((d) => (
              <option key={d} value={d}>
                {t(`diets.${d}`)}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-semibold text-plum">{t('restaurants.show')}</legend>
          <div className="mt-1 flex gap-1 rounded-full bg-blush p-1">
            {(['all', 'listed', 'sample'] as Show[]).map((k) => (
              <label
                key={k}
                className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-center text-xs font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-rose ${
                  filters.show === k
                    ? 'bg-paper text-plum shadow-soft'
                    : 'text-mist hover:text-plum'
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-show`}
                  value={k}
                  checked={filters.show === k}
                  onChange={() => set({ show: k })}
                  className="sr-only"
                />
                {t(`restaurants.showOptions.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-plum sm:col-span-2">
          <input
            type="checkbox"
            checked={filters.evidenceOnly}
            onChange={(e) => set({ evidenceOnly: e.target.checked })}
            className="h-4 w-4 accent-rose"
          />
          {t('restaurants.evidenceOnly')}
        </label>
      </form>

      <p aria-live="polite" className="text-xs font-semibold text-mist">
        {t('restaurants.count', { count: results.length })}
      </p>

      {results.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {results.map((r) => (
            <RestaurantCard key={r.id} r={r} diet={filters.diet} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-petal p-6 text-center text-sm text-mist">
          <p>{t('restaurants.empty')}</p>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="mt-3 font-semibold text-rose underline-offset-4 hover:underline"
          >
            {t('restaurants.reset')}
          </button>
        </div>
      )}

      <p className="text-xs text-mist">{t('restaurants.footer')}</p>
    </div>
  );
}

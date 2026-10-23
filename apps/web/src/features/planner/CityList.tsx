import { useTranslation } from 'react-i18next';
import { CITIES } from './data';
import { usePlannerStore } from './usePlannerStore';

/** Keyboard-friendly list of every city on the map (also the no-WebGL way in). */
export function CityList() {
  const { t } = useTranslation();
  const selectCity = usePlannerStore((s) => s.focusCity);
  return (
    <nav aria-labelledby="city-list-title">
      <h2 id="city-list-title" className="font-display text-2xl text-plum">
        {t('planner.pickCity')}
      </h2>
      <p className="mt-1 text-sm text-mist">{t('planner.pickCityHint')}</p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {CITIES.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => selectCity(c.id)}
              className="w-full rounded-2xl border border-blush bg-white/80 px-3 py-2 text-left transition hover:border-rose"
            >
              <span lang="ja" className="block font-display text-sm text-rose">
                {c.nameJa}
              </span>
              <span className="block text-sm font-semibold text-plum">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

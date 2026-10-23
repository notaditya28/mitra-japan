import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { PhrasePreview } from '../fears/PhrasePreview';
import { animeForCity, heritageNear, regionalForCity, spotsForCity, type City } from './data';
import { LAYER_COLORS } from './map/layerColors';

const VEG_STYLE = {
  high: 'bg-matcha/35 text-plum',
  medium: 'bg-gold/35 text-plum',
  low: 'bg-sakura/20 text-rose',
} as const;

/** Everything a traveller needs about one city: culture, food, phrases and nearby highlights. */
export function CityCard({ city, onClose }: { city: City; onClose: () => void }) {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const spots = spotsForCity(city.id);
  const heritage = heritageNear(city);
  const anime = animeForCity(city.id);
  const regional = regionalForCity(city.id);

  return (
    <article aria-labelledby={`city-${city.id}`} className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p lang="ja" className="font-display text-lg text-rose">
            {city.nameJa}
          </p>
          <h2 id={`city-${city.id}`} className="display text-4xl text-plum">
            {city.name}
          </h2>
          <p className="mt-1 text-sm text-mist">
            {t('planner.fromTokyo')}:{' '}
            <span className="font-semibold text-plum">{city.fromTokyo}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('planner.close')}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-blush text-plum transition hover:border-rose"
        >
          ×
        </button>
      </header>

      <p className="text-ink">{city.culture}</p>
      <p className="rounded-2xl bg-blush/60 px-4 py-3 text-sm text-plum">
        <span className="font-semibold">{t('planner.season')}:</span> {city.season}
      </p>

      <section aria-labelledby={`food-${city.id}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id={`food-${city.id}`} className="font-display text-xl text-plum">
            {t('planner.food')}
          </h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${VEG_STYLE[city.vegLevel]}`}
          >
            {t(`planner.vegLevel.${city.vegLevel}`)}
          </span>
        </div>
        <p className="text-sm text-ink">{city.veg}</p>
        {spots.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {spots.map((s) => {
              const suits = diet === 'none' || s.diets.includes(diet);
              return (
                <li key={s.id} className="rounded-2xl border border-blush bg-white/80 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-plum">{s.title}</p>
                      <p className="text-xs text-mist">
                        {t(`planner.kinds.${s.kind}`)} · {s.area}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-mist/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mist">
                      {t('planner.demoData')}
                    </span>
                  </div>
                  <p className={`mt-2 text-xs font-semibold ${suits ? 'text-plum' : 'text-rose'}`}>
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ background: suits ? LAYER_COLORS.vegSafe : LAYER_COLORS.anime }}
                    />
                    {suits
                      ? t('planner.suits', { diet: t(`diets.${diet}`) })
                      : t('planner.askFirst')}
                  </p>
                  {s.risks.length > 0 ? (
                    <p className="mt-1 text-xs text-mist">
                      {t('planner.check')}: {s.risks.map((r) => t(`planner.risks.${r}`)).join(', ')}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink">{s.note}</p>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <section aria-label={t('phrase.show')}>
        <PhrasePreview />
      </section>

      {heritage.length + anime.length + regional.length > 0 ? (
        <section aria-labelledby={`near-${city.id}`}>
          <h3 id={`near-${city.id}`} className="mb-2 font-display text-xl text-plum">
            {t('planner.nearby')}
          </h3>
          <ul className="space-y-2 text-sm">
            {heritage.map((h) => (
              <li key={h.id} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: LAYER_COLORS.heritage }}
                />
                <span>
                  <span className="font-semibold text-plum">
                    {t(`roots.indian.${h.id}`)} · {h.japanese}
                  </span>{' '}
                  <span className="text-mist">{h.place}</span>
                </span>
              </li>
            ))}
            {anime.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: LAYER_COLORS.anime }}
                />
                <span>
                  <span className="font-semibold text-plum">{a.name}</span>{' '}
                  <span className="text-mist">{a.note}</span>
                </span>
              </li>
            ))}
            {regional.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: LAYER_COLORS.regional }}
                />
                <span>
                  <span className="font-semibold text-plum">{r.name}</span>{' '}
                  <span className="text-mist">{r.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-mist">{t('planner.timesNote')}</p>
    </article>
  );
}

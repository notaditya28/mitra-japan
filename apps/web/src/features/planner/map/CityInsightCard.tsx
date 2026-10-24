import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../../components/StatusBadge';
import { cityById } from '../data';

/**
 * Small, closable card on the map after a city is clicked (team guide 2.7; owner choice:
 * on the map, not a side panel). Rail time is our labelled estimate from cities.json.
 */
export function CityInsightCard({ cityId }: { cityId: string | null }) {
  const { t } = useTranslation();
  const [closed, setClosed] = useState<string | null>(null);
  // Picking another city opens the card again.
  useEffect(() => setClosed(null), [cityId]);
  const city = cityId ? cityById(cityId) : undefined;
  if (!city || closed === city.id) return null;

  return (
    <section
      aria-label={t('cityCard.label', { city: city.name })}
      className="absolute bottom-12 left-3 z-10 w-[min(88vw,300px)] rounded-2xl border border-white/30 bg-paper/95 p-3 text-xs text-ink shadow-lift backdrop-blur-sm sm:left-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg leading-tight text-plum">
          <span lang="ja" className="mr-1.5">
            {city.nameJa}
          </span>
          · {city.name}
        </h3>
        <button
          type="button"
          onClick={() => setClosed(city.id)}
          aria-label={t('planner.close')}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blush text-plum hover:bg-petal"
        >
          ×
        </button>
      </div>
      <dl className="mt-2 space-y-1.5">
        <div>
          <dt className="font-semibold text-plum">{t('cityCard.fromTokyo')}</dt>
          <dd>
            {city.fromTokyo} <StatusBadge status="estimate" className="ml-1 align-middle" />
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-plum">{t('planner.season')}</dt>
          <dd>{city.season}</dd>
        </div>
        <div>
          <dt className="font-semibold text-plum">{t('cityCard.culture')}</dt>
          <dd>{city.culture}</dd>
        </div>
        <div>
          <dt className="font-semibold text-plum">{t('cityCard.veg')}</dt>
          <dd>
            <span className="font-semibold">{t(`planner.vegLevel.${city.vegLevel}`)}</span> ·{' '}
            {city.veg}
          </dd>
        </div>
      </dl>
      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-mist">
        <StatusBadge status={city.status} />
        {t('cityCard.note')}
      </p>
    </section>
  );
}

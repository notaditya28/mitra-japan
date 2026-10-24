import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../../components/StatusBadge';
import { useAskMitra } from '../../assistant/useAskMitra';
import { prefectureInfo } from '../prefecture';
import { usePlannerStore } from '../usePlannerStore';
import { LAYER_COLORS } from './layerColors';

const MAX_PLACES = 6;

/**
 * Card for a clicked prefecture that has none of our cities (owner request, 2026-10-25:
 * those used to show nothing). Only what our data holds: names, region, the places we list
 * there, our nearest cities by straight-line distance, and a hand-off to Ask Mitra.
 */
export function PrefectureCard({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const info = useMemo(() => prefectureInfo(id), [id]);
  const focusCity = usePlannerStore((s) => s.focusCity);
  const ask = useAskMitra((s) => s.ask);
  if (!info) return null;
  const more = info.places.length - MAX_PLACES;

  return (
    <section
      aria-label={t('prefCard.label', { name: info.name })}
      className="absolute bottom-[calc(132px+4.25rem)] left-3 z-10 max-h-[55%] w-[min(88vw,320px)] overflow-y-auto rounded-2xl border border-white/30 bg-paper/95 p-3 text-xs text-ink shadow-lift backdrop-blur-sm sm:left-4 lg:bottom-24"
      data-lenis-prevent
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg leading-tight text-plum">
            <span lang="ja" className="mr-1.5">
              {info.nameJa}
            </span>
            · {info.name}
          </h3>
          {info.region ? (
            <p className="mt-0.5 text-mist">
              {t('prefCard.region', { region: t(`prefCard.regions.${info.region}`) })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('prefCard.close')}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blush text-plum hover:bg-petal"
        >
          ×
        </button>
      </div>

      <h4 className="mt-3 font-semibold text-plum">{t('prefCard.inData')}</h4>
      {info.places.length === 0 ? (
        <p className="mt-1 text-mist">{t('prefCard.noPlaces')}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {info.places.slice(0, MAX_PLACES).map((p) => (
            <li key={`${p.layer}-${p.id}`} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: LAYER_COLORS[p.layer] }}
              />
              <span>
                <span className="font-semibold">{p.name}</span>
                <span className="text-mist"> · {t(`planner.layers.${p.layer}.name`)}</span>
              </span>
            </li>
          ))}
          {more > 0 ? <li className="text-mist">{t('prefCard.more', { count: more })}</li> : null}
        </ul>
      )}

      {info.nearest.length > 0 ? (
        <>
          <h4 className="mt-3 font-semibold text-plum">{t('prefCard.nearest')}</h4>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {info.nearest.map(({ city, km }) => (
              <li key={city.id}>
                <button
                  type="button"
                  onClick={() => focusCity(city.id)}
                  className="rounded-full border border-petal bg-blush px-2.5 py-1 font-semibold text-plum hover:border-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
                >
                  {city.name} · {t('prefCard.km', { km })}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-mist">
            <StatusBadge status="estimate" />
            {t('prefCard.distanceNote')}
          </p>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => ask(t('prefCard.question', { name: info.name }))}
        className="btn-primary mt-3 w-full !py-2 text-xs"
      >
        {t('prefCard.ask', { name: info.name })}
      </button>
      <p className="mt-2 text-[10px] text-mist">{t('prefCard.note')}</p>
    </section>
  );
}

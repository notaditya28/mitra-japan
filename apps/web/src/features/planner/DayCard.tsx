import { forwardRef, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reasonText } from './confidenceText';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore } from '../../store/useAppStore';
import { ConfidenceRing } from './ConfidenceRing';
import { cityById, stopStatus } from './data';
import { foodConfidence } from './foodConfidence';
import type { Day } from './itinerary';
import { usePlannerStore } from './usePlannerStore';

const FLAG_STYLE = 'rounded-full bg-gold/30 px-2 py-0.5 text-[11px] font-semibold text-plum';

interface DayCardProps {
  day: Day;
  selected: boolean;
  /** Previews stream in before validation finishes; they can't be edited yet. */
  preview?: boolean;
  onShowCity: (cityId: string) => void;
}

/** One editable itinerary day: stops, transport estimate, stay, Food Confidence and flags. */
export const DayCard = forwardRef<HTMLElement, DayCardProps>(function DayCard(
  { day, selected, preview = false, onShowCity },
  ref,
) {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const focusDay = usePlannerStore((s) => s.focusDay);
  const regenerate = usePlannerStore((s) => s.regenerate);
  const regenerating = usePlannerStore((s) => s.regenerating === day.day);
  const dayError = usePlannerStore((s) => (s.dayError?.day === day.day ? s.dayError.error : null));
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [showWhy, setShowWhy] = useState(false);
  const inputId = useId();
  const city = cityById(day.cityId);
  const from = day.transport.fromCityId ? cityById(day.transport.fromCityId) : undefined;
  const confidence = useMemo(() => foodConfidence(day, diet), [day, diet]);

  return (
    <article
      ref={ref}
      aria-labelledby={`${inputId}-title`}
      aria-current={selected ? 'true' : undefined}
      className={`card p-4 transition-shadow duration-300 sm:p-5 ${
        selected ? 'ring-2 ring-sakura' : ''
      } ${preview ? 'opacity-80' : ''}`}
    >
      <button
        type="button"
        onClick={() => focusDay(day.day)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <p className="eyebrow text-rose">
            {t('trip.day', { n: day.day })} ·{' '}
            <span lang="ja" className="font-display normal-case tracking-normal">
              {city?.nameJa}
            </span>{' '}
            {city?.name}
          </p>
          <h3 id={`${inputId}-title`} className="mt-1 font-display text-xl leading-snug text-plum">
            {day.title}
          </h3>
        </div>
        <ConfidenceRing score={confidence.score} level={confidence.level} size={56} />
      </button>

      {day.flags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('trip.warnings')}>
          {day.flags.map((f, i) => (
            <li key={`${f.code}-${i}`} className={FLAG_STYLE} title={f.message}>
              {t(`trip.flags.${f.code}`)}
              <span className="sr-only">: {f.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <ol className="mt-3 space-y-1.5 text-sm">
        {day.stops.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex items-start gap-2">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blush text-[10px] font-bold text-plum">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-plum">{s.name}</span>{' '}
              {s.inOurData ? (
                <StatusBadge status={stopStatus(s)} className="align-middle" />
              ) : (
                <span className="text-[11px] text-mist">· {t('trip.suggestion')}</span>
              )}
              {s.note ? <span className="block text-xs text-mist">{s.note}</span> : null}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-3 space-y-1 rounded-2xl bg-blush/50 px-3 py-2 text-xs text-plum">
        <p>
          <span className="font-semibold">{t(`trip.modes.${day.transport.mode}`)}</span>
          {from ? ` · ${t('trip.from', { city: from.name })}` : ''}
          {day.transport.estimatedHours !== null && day.transport.distanceKm !== null ? (
            <>
              {' · '}
              {t('trip.estimate', {
                h: day.transport.estimatedHours,
                km: day.transport.distanceKm,
              })}{' '}
              <StatusBadge status="estimate" className="align-middle" />
            </>
          ) : null}
        </p>
        {day.transport.note ? <p className="text-mist">{day.transport.note}</p> : null}
        <p>
          <span className="font-semibold">{t('trip.stay')}:</span>{' '}
          {t(`trip.stayTypes.${day.stay.type}`)}
          {day.stay.area ? ` · ${day.stay.area}` : ''}
        </p>
      </div>

      <div className="mt-3 text-sm">
        <p className="text-ink">{day.foodNotes}</p>
        <button
          type="button"
          aria-expanded={showWhy}
          onClick={() => setShowWhy((v) => !v)}
          className="mt-1 text-xs font-semibold text-rose underline-offset-4 hover:underline"
        >
          {t('trip.why')}
        </button>
        {showWhy ? (
          <div className="mt-2 space-y-2 rounded-2xl border border-blush bg-white/70 p-3 text-xs">
            <ul className="space-y-1">
              {confidence.reasons.map((r) => (
                <li key={r.key} className="flex justify-between gap-3">
                  <span>{reasonText(r, t)}</span>
                  {r.points !== 0 ? (
                    <span
                      className={`shrink-0 font-semibold ${r.points > 0 ? 'text-plum' : 'text-rose'}`}
                    >
                      {r.points > 0 ? `+${r.points}` : r.points}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {day.foodReasons.length > 0 ? (
              <div>
                <p className="font-semibold text-plum">{t('trip.guideNotes')}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-mist">
                  {day.foodReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {day.tips.length > 0 ? (
        <ul
          className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-mist"
          aria-label={t('trip.tips')}
        >
          {day.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}

      {!preview ? (
        <div className="mt-4 border-t border-blush pt-3">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void regenerate(day.day, instruction.trim()).then(() => setEditing(false));
              }}
              className="flex flex-col gap-2"
            >
              <label htmlFor={inputId} className="text-xs font-semibold text-plum">
                {t('trip.regenerate')}
              </label>
              <input
                id={inputId}
                value={instruction}
                maxLength={300}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={t('trip.regeneratePlaceholder')}
                className="rounded-xl border border-petal bg-paper px-3 py-2 text-sm outline-none focus:border-rose focus:ring-2 focus:ring-rose/30"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={regenerating}
                  className="btn-primary !px-4 !py-2 text-sm"
                >
                  {regenerating ? t('trip.regenerating', { n: day.day }) : t('trip.regenerateGo')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-ghost !px-4 !py-2 text-sm text-mist"
                >
                  {t('trip.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full border border-petal px-3 py-1.5 text-xs font-semibold text-plum transition hover:border-rose"
              >
                {t('trip.regenerate')}
              </button>
              <button
                type="button"
                onClick={() => onShowCity(day.cityId)}
                className="rounded-full border border-petal px-3 py-1.5 text-xs font-semibold text-plum transition hover:border-rose"
              >
                {t('trip.cityInfo')}
              </button>
            </div>
          )}
          {dayError ? (
            <p role="alert" className="mt-2 text-xs text-torii">
              {t(`guide.errors.${dayError.code}`, { s: dayError.retryAfter ?? 60 })}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
});

import { forwardRef, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { reasonText } from './confidenceText';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore } from '../../store/useAppStore';
import { ConfidenceRing } from './ConfidenceRing';
import { cityById, stopStatus } from './data';
import { foodConfidence } from './foodConfidence';
import { SLOTS, type Day, type Slot } from './itinerary';
import { usePlannerStore } from './usePlannerStore';
import { useAssistantStore } from '../assistant/useAssistantStore';

const FLAG_STYLE = 'rounded-full bg-gold/30 px-2 py-0.5 text-[11px] font-semibold text-plum';
const SLOT_ICON: Record<Slot, string> = { morning: '🌅', afternoon: '☀️', evening: '🌙' };

interface DayCardProps {
  day: Day;
  selected: boolean;
  /** Previews stream in before validation finishes; they can't be edited yet. */
  preview?: boolean;
  onShowCity: (cityId: string) => void;
}

/**
 * One editable itinerary day (team guide 2.4): morning, afternoon and evening stops
 * (click one to fly the map to it), the meal plan, transport estimate, stay, Food
 * Confidence and flags, and a "Redesign this day" dialog that leaves other days alone.
 */
export const DayCard = forwardRef<HTMLElement, DayCardProps>(function DayCard(
  { day, selected, preview = false, onShowCity },
  ref,
) {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const focusDay = usePlannerStore((s) => s.focusDay);
  const focusStop = usePlannerStore((s) => s.focusStop);
  const focused = usePlannerStore((s) =>
    s.focusedStop?.day === day.day ? s.focusedStop.index : null,
  );
  const regenerate = usePlannerStore((s) => s.regenerate);
  const regenerating = usePlannerStore((s) => s.regenerating === day.day);
  const dayError = usePlannerStore((s) => (s.dayError?.day === day.day ? s.dayError.error : null));
  const pinned = useAssistantStore((s) => s.pinned);
  const togglePin = useAssistantStore((s) => s.togglePin);
  const justChanged = useAssistantStore((s) => s.changedDays.includes(day.day));
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [showWhy, setShowWhy] = useState(false);
  const inputId = useId();
  const city = cityById(day.cityId);
  const from = day.transport.fromCityId ? cityById(day.transport.fromCityId) : undefined;
  const confidence = useMemo(() => foodConfidence(day, diet), [day, diet]);
  const meals = (['breakfast', 'lunch', 'dinner'] as const).filter((m) => day.meals[m]);
  const examples = t('trip.redesignExamples', { returnObjects: true }) as string[];

  return (
    <article
      ref={ref}
      aria-labelledby={`${inputId}-title`}
      aria-current={selected ? 'true' : undefined}
      className={`card p-4 transition-shadow duration-300 sm:p-5 ${
        selected ? 'ring-2 ring-sakura' : ''
      } ${justChanged ? 'ring-4 ring-matcha/70 motion-safe:animate-pulse' : ''} ${preview ? 'opacity-80' : ''}`}
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

      {day.flags.length > 0 || day.pace ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('trip.warnings')}>
          {day.pace ? (
            <li className="rounded-full bg-blush px-2 py-0.5 text-[11px] font-semibold text-plum">
              {t('trip.pace', { pace: t(`tripOptions.paces.${day.pace}`) })}
            </li>
          ) : null}
          {day.flags.map((f, i) => (
            <li key={`${f.code}-${i}`} className={FLAG_STYLE} title={f.message}>
              {t(`trip.flags.${f.code}`)}
              <span className="sr-only">: {f.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 space-y-3 text-sm">
        {SLOTS.map((slot) => {
          const items = day.stops.map((s, i) => ({ s, i })).filter(({ s }) => s.slot === slot);
          if (items.length === 0) return null;
          return (
            <section key={slot} aria-label={t(`trip.slots.${slot}`)}>
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-mist">
                <span aria-hidden="true">{SLOT_ICON[slot]}</span>
                {t(`trip.slots.${slot}`)}
              </h4>
              <ol className="mt-1 space-y-1.5">
                {items.map(({ s, i }) => {
                  const mappable = s.lat !== null && s.lng !== null;
                  const key = `${day.cityId}|${s.name}`;
                  return (
                    <li key={`${s.name}-${i}`} className="flex items-start gap-2">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blush text-[10px] font-bold text-plum">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => focusStop(day.day, i)}
                          aria-pressed={focused === i}
                          title={mappable ? t('trip.flyTo') : t('trip.flyToCity')}
                          className={`text-left font-semibold underline-offset-4 hover:underline ${
                            focused === i ? 'text-rose' : 'text-plum'
                          }`}
                        >
                          {s.name}
                        </button>{' '}
                        {s.inOurData ? (
                          <StatusBadge status={stopStatus(s)} className="align-middle" />
                        ) : (
                          <span className="text-[11px] text-mist">· {t('trip.suggestion')}</span>
                        )}
                        {s.durationMinutes ? (
                          <span className="ml-1 text-[11px] text-mist">
                            · {t('trip.duration', { min: s.durationMinutes })}
                          </span>
                        ) : null}
                        {s.note ? <span className="block text-xs text-mist">{s.note}</span> : null}
                      </span>
                      {!preview ? (
                        <button
                          type="button"
                          onClick={() => togglePin(day.cityId, s.name)}
                          aria-pressed={pinned.includes(key)}
                          aria-label={t('assistant.pin.toggle', { name: s.name })}
                          title={t('assistant.pin.help')}
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                            pinned.includes(key)
                              ? 'bg-plum text-paper'
                              : 'bg-blush text-mist hover:text-plum'
                          }`}
                        >
                          {pinned.includes(key)
                            ? t('assistant.pin.pinned')
                            : t('assistant.pin.pin')}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      {meals.length > 0 || day.meals.dietaryNotes ? (
        <section
          aria-label={t('trip.meals.title')}
          className="mt-3 rounded-2xl border border-matcha/50 bg-matcha/10 px-3 py-2 text-xs text-ink"
        >
          <p className="font-semibold text-plum">{t('trip.meals.title')}</p>
          <dl className="mt-1 space-y-0.5">
            {meals.map((m) => (
              <div key={m} className="flex gap-1.5">
                <dt className="shrink-0 font-semibold text-plum">{t(`trip.meals.${m}`)}:</dt>
                <dd>{day.meals[m]}</dd>
              </div>
            ))}
          </dl>
          {day.meals.dietaryNotes ? (
            <p className="mt-1 text-mist">{day.meals.dietaryNotes}</p>
          ) : null}
        </section>
      ) : null}

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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={regenerating}
              className="rounded-full border border-petal px-3 py-1.5 text-xs font-semibold text-plum transition hover:border-rose disabled:opacity-60"
            >
              {regenerating ? t('trip.regenerating', { n: day.day }) : t('trip.regenerate')}
            </button>
            <button
              type="button"
              onClick={() => onShowCity(day.cityId)}
              className="rounded-full border border-petal px-3 py-1.5 text-xs font-semibold text-plum transition hover:border-rose"
            >
              {t('restaurants.showOnMap')}
            </button>
          </div>
          {dayError ? (
            <p role="alert" className="mt-2 text-xs text-torii">
              {t(`guide.errors.${dayError.code}`, { s: dayError.retryAfter ?? 60 })}
            </p>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        size="sm"
        eyebrow={t('trip.day', { n: day.day })}
        title={t('trip.redesignTitle')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void regenerate(day.day, instruction.trim()).then(() => {
              if (!usePlannerStore.getState().dayError) {
                setEditing(false);
                setInstruction('');
              }
            });
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-xs text-mist">{t('trip.redesignHelp')}</p>
          <label htmlFor={inputId} className="text-xs font-semibold text-plum">
            {t('trip.redesignLabel')}
          </label>
          <textarea
            id={inputId}
            value={instruction}
            rows={3}
            maxLength={300}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t('trip.regeneratePlaceholder')}
            className="resize-none rounded-xl border border-petal bg-paper px-3 py-2 text-sm outline-none focus:border-rose focus:ring-2 focus:ring-rose/30"
          />
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInstruction(ex)}
                className="rounded-full border border-petal bg-blush px-2.5 py-1 text-xs text-plum hover:border-rose"
              >
                {ex}
              </button>
            ))}
          </div>
          {dayError ? (
            <p role="alert" className="text-xs text-torii">
              {t(`guide.errors.${dayError.code}`, { s: dayError.retryAfter ?? 60 })}
            </p>
          ) : null}
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
      </Dialog>
    </article>
  );
});

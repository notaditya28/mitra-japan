import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlannerStore } from '../planner/usePlannerStore';
import {
  buildSchedule,
  defaultActivities,
  emptyDraft,
  planKey,
  useScheduleStore,
  useSchedulePrint,
} from './schedule';

const field =
  'w-full rounded-xl border border-petal bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-rose focus:ring-2 focus:ring-rose/30';

/**
 * Schedule of Stay draft from the current plan: pick the arrival date, fill in each
 * night's accommodation, then print or save it as a PDF. Our own layout, clearly not
 * an official form; the traveller copies it into whatever format the consulate wants.
 */
export default function SchedulePanel() {
  const { t } = useTranslation();
  const id = useId();
  const itinerary = usePlannerStore((s) => s.itinerary);
  const key = itinerary ? planKey(itinerary) : '';
  const draft = useScheduleStore((s) => s.drafts[key]) ?? emptyDraft();
  const update = useScheduleStore((s) => s.update);
  const updateEntry = useScheduleStore((s) => s.updateEntry);
  const print = useSchedulePrint((s) => s.print);
  const rows = useMemo(
    () => (itinerary ? buildSchedule(itinerary, draft) : []),
    [itinerary, draft],
  );

  if (!itinerary) {
    return <p className="py-6 text-center text-sm text-mist">{t('schedule.needPlan')}</p>;
  }

  const incomplete = rows.filter((r) => r.missing.length > 0).length;
  const noDate = !draft.startDate;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (noDate) return;
        print({ applicant: draft.applicant.trim(), rows });
      }}
      noValidate
    >
      <div className="rounded-2xl bg-gold/20 px-4 py-3 text-sm text-plum">
        <p className="font-semibold">{t('schedule.notOfficial')}</p>
        <p className="mt-1 text-xs">{t('schedule.explain')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-start`} className="text-xs font-semibold text-plum">
            {t('schedule.startDate')} <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${id}-start`}
            type="date"
            required
            value={draft.startDate}
            onChange={(e) => update(key, { startDate: e.target.value })}
            aria-invalid={noDate}
            aria-describedby={noDate ? `${id}-start-err` : undefined}
            className={`${field} mt-1`}
          />
          {noDate ? (
            <p id={`${id}-start-err`} className="mt-1 text-xs text-torii">
              {t('schedule.startDateNeeded')}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor={`${id}-name`} className="text-xs font-semibold text-plum">
            {t('schedule.applicant')}
          </label>
          <input
            id={`${id}-name`}
            type="text"
            autoComplete="name"
            maxLength={80}
            value={draft.applicant}
            onChange={(e) => update(key, { applicant: e.target.value })}
            className={`${field} mt-1`}
          />
          <p className="mt-1 text-[11px] text-mist">{t('schedule.noIds')}</p>
        </div>
      </div>

      <ol className="space-y-3">
        {rows.map((r) => {
          const e = draft.entries[r.day];
          const rid = `${id}-d${r.day}`;
          return (
            <li key={r.day} className="rounded-2xl border border-blush bg-white/80 p-4">
              <p className="text-sm font-semibold text-plum">
                {t('trip.day', { n: r.day })} · {r.date ?? t('schedule.noDate')} · {r.city}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor={`${rid}-act`} className="text-xs font-semibold text-plum">
                    {t('schedule.activities')}
                  </label>
                  <textarea
                    id={`${rid}-act`}
                    rows={2}
                    maxLength={400}
                    value={e?.activities ?? defaultActivities(itinerary, r.day)}
                    onChange={(ev) => updateEntry(key, r.day, { activities: ev.target.value })}
                    className={`${field} mt-1 resize-none`}
                  />
                </div>
                {(['hotel', 'address', 'phone'] as const).map((k) => (
                  <div key={k} className={k === 'address' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={`${rid}-${k}`} className="text-xs font-semibold text-plum">
                      {t(`schedule.${k}`)}
                    </label>
                    <input
                      id={`${rid}-${k}`}
                      type={k === 'phone' ? 'tel' : 'text'}
                      maxLength={k === 'address' ? 200 : 100}
                      value={e?.[k] ?? ''}
                      onChange={(ev) => updateEntry(key, r.day, { [k]: ev.target.value })}
                      className={`${field} mt-1`}
                    />
                  </div>
                ))}
              </div>
              {r.missing.length > 0 ? (
                <p className="mt-2 text-xs text-mist">
                  {t('schedule.missing', {
                    list: r.missing.map((m) => t(`schedule.${m}`)).join(', '),
                  })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={noDate}
          className="btn-primary !py-2.5 text-sm disabled:opacity-50"
        >
          {t('schedule.print')}
        </button>
        <p className="text-xs text-mist" aria-live="polite">
          {incomplete > 0
            ? t('schedule.incomplete', { count: incomplete })
            : t('schedule.complete')}
        </p>
      </div>
      <p className="text-xs text-mist">{t('schedule.storage')}</p>
    </form>
  );
}

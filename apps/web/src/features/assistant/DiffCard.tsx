import { useTranslation } from 'react-i18next';
import { cityById } from '../planner/data';
import type { AssistantMessage } from './useAssistantStore';
import { diffCounts } from './model';
import type { StopDiff } from './types';

const STOP_STYLE: Record<StopDiff['status'], string> = {
  kept: 'text-mist',
  added: 'bg-matcha/30 text-plum font-semibold',
  replaced: 'bg-matcha/30 text-plum font-semibold',
  'moved-in': 'bg-gold/30 text-plum font-semibold',
  'moved-out': 'text-mist line-through',
  removed: 'bg-torii/10 text-torii line-through',
};

const MARK: Record<StopDiff['status'], string> = {
  kept: '·',
  added: '+',
  replaced: '↺',
  'moved-in': '→',
  'moved-out': '←',
  removed: '−',
};

/** Before/after preview of a proposed itinerary change, with Apply / Edit / Dismiss. */
export function DiffCard({
  message,
  onApply,
  onEdit,
  onDismiss,
}: {
  message: AssistantMessage;
  onApply: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const proposal = message.response.proposed_patch;
  if (!proposal) return null;
  const days = proposal.diff?.days ?? [];
  const changed = days.filter((d) => d.status !== 'unchanged');
  const counts = diffCounts(days);
  const state = message.patchState ?? 'proposed';

  return (
    <section
      aria-label={t('assistant.diff.label')}
      className="mt-3 rounded-2xl border border-petal bg-paper p-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-rose">
        {t('assistant.diff.title')}
      </p>
      <p className="mt-1 text-sm font-semibold text-plum">{proposal.patch.summary}</p>
      <p className="mt-1 text-xs text-mist">
        {t('assistant.diff.counts', {
          added: counts.added,
          removed: counts.removed,
          kept: counts.kept,
          days: counts.changedDays,
        })}
      </p>

      <ul className="mt-2 space-y-2">
        {changed.map((d) => (
          <li key={`${d.day}-${d.title}-${d.status}`} className="rounded-xl bg-white/80 p-2">
            <p className="text-xs font-bold text-plum">
              {t('trip.day', { n: d.day })} · {cityById(d.cityId)?.name ?? d.cityId}
              {d.status === 'added' ? (
                <span className="ml-1 text-matcha">({t('assistant.diff.newDay')})</span>
              ) : null}
              {d.status === 'removed' ? (
                <span className="ml-1 text-torii">({t('assistant.diff.removedDay')})</span>
              ) : null}
            </p>
            <ul className="mt-1 space-y-0.5">
              {d.stops.map((s, i) => (
                <li
                  key={`${s.name}-${i}`}
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs ${STOP_STYLE[s.status]}`}
                >
                  <span aria-hidden="true" className="w-3 text-center">
                    {MARK[s.status]}
                  </span>
                  <span>{s.name}</span>
                  <span className="sr-only">: {t(`assistant.diff.status.${s.status}`)}</span>
                  {s.pinned ? (
                    <span className="ml-auto text-[10px] font-bold uppercase text-plum">
                      {t('assistant.pin.pinned')}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {proposal.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-plum">
          {proposal.warnings.map((w) => (
            <li key={w} className="rounded-lg bg-gold/20 px-2 py-1">
              {w}
            </li>
          ))}
        </ul>
      ) : null}
      {proposal.patch.booking_notes.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs font-semibold text-torii">
          {proposal.patch.booking_notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-mist">{t('assistant.diff.unchangedNote')}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
        {state === 'proposed' || state === 'failed' ? (
          <>
            <button type="button" onClick={onApply} className="btn-primary !px-4 !py-1.5 text-xs">
              {t('assistant.diff.apply')}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full bg-blush px-3 py-1.5 text-xs font-semibold text-plum hover:bg-petal"
            >
              {t('assistant.diff.edit')}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs font-semibold text-mist underline-offset-4 hover:underline"
            >
              {t('assistant.diff.dismiss')}
            </button>
          </>
        ) : null}
        {state === 'applying' ? (
          <span className="text-xs text-plum">{t('assistant.diff.applying')}</span>
        ) : null}
        {state === 'applied' ? (
          <span className="text-xs font-semibold text-plum">✓ {t('assistant.diff.applied')}</span>
        ) : null}
        {state === 'dismissed' ? (
          <span className="text-xs text-mist">{t('assistant.diff.dismissed')}</span>
        ) : null}
        {state === 'undone' ? (
          <span className="text-xs text-mist">{t('assistant.diff.undone')}</span>
        ) : null}
        {state === 'failed' ? (
          <span role="alert" className="text-xs font-semibold text-torii">
            {t(`assistant.errors.${message.patchError ?? 'unknown'}`, {
              defaultValue: t('assistant.errors.unknown'),
            })}
          </span>
        ) : null}
      </div>
    </section>
  );
}

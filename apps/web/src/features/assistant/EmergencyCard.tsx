import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../components/StatusBadge';
import { safeUrl } from './model';
import { telHref } from './offline';
import type { EmergencyPayload } from './types';

/** Emergency guidance: the urgent action first, then steps, contacts and sources. */
export function EmergencyCard({ payload }: { payload: EmergencyPayload }) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={payload.title}
      className="rounded-2xl border-2 border-torii/60 bg-paper p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-torii">
          {t(`assistant.emergency.kinds.${payload.kind}`, { defaultValue: payload.title })}
        </p>
        <StatusBadge status={payload.status === 'verified' ? 'verified' : 'needs-review'} />
      </div>
      <p className="mt-2 text-base font-bold leading-snug text-plum">{payload.urgent_action}</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink">
        {payload.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-plum">
        {t('assistant.emergency.contacts')}
      </h4>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {payload.contacts.map((c) => {
          const tel = c.kind === 'phone' ? telHref(c.value) : null;
          return (
            <li key={`${c.label}-${c.value}`} className="rounded-xl bg-blush/60 px-3 py-2">
              <p className="text-xs text-mist">{c.label}</p>
              {tel ? (
                <a
                  href={tel}
                  className="text-lg font-bold text-plum underline-offset-4 hover:underline"
                >
                  {c.value}
                </a>
              ) : (
                <p className="text-lg font-bold text-plum">{c.value}</p>
              )}
              {c.note ? <p className="text-[11px] text-mist">{c.note}</p> : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs font-semibold text-torii">{payload.disclaimer}</p>
      <p className="mt-2 text-xs text-plum">{payload.replan_prompt}</p>
      <p className="mt-2 text-[11px] text-mist">
        {payload.offline ? `${t('assistant.emergency.offline')} · ` : ''}
        {t('assistant.emergency.sources')}:{' '}
        {payload.sources.map((u, i) => {
          const url = safeUrl(u);
          return url ? (
            <a
              key={u}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose underline-offset-2 hover:underline"
            >
              [{i + 1}]
            </a>
          ) : null;
        })}
      </p>
    </section>
  );
}

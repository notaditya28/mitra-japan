import { motion, useReducedMotion } from 'framer-motion';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DiffCard } from './DiffCard';
import { EmergencyCard } from './EmergencyCard';
import type { NearbyPlace } from './offline';
import { ConfidenceBadge } from './SourcesDrawer';
import type { AssistantMessage, ChatMessage } from './useAssistantStore';

const URL_RE = /(https:\/\/[^\s)]+)/g;

/** Plain text with https links made clickable (only https, only as plain anchors). */
function linkify(text: string): ReactNode {
  const parts = text.split(URL_RE);
  return parts.map((p, i) =>
    /^https:\/\//.test(p) ? (
      <a
        key={i}
        href={p}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-rose underline-offset-2 hover:underline"
      >
        {p}
      </a>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

function AssistantBubble({
  m,
  onSource,
  onApply,
  onEdit,
  onDismiss,
}: {
  m: AssistantMessage;
  onSource: (n: number) => void;
  onApply: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const r = m.response;
  return (
    <div className="rounded-2xl rounded-tl-sm border border-blush bg-white/90 p-3 text-sm text-ink">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {r.intent !== 'emergency' && r.intent !== 'smalltalk' && r.intent !== 'clarify' ? (
          <ConfidenceBadge level={r.confidence} />
        ) : null}
        {r.mode === 'demo' ? (
          <span className="rounded-full bg-gold/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-plum">
            {t('assistant.demoBadge')}
          </span>
        ) : null}
      </div>

      {r.emergency ? (
        <EmergencyCard payload={r.emergency} />
      ) : (
        <ul className="space-y-1.5">
          {r.statements.map((s, i) => (
            <motion.li
              key={i}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : i * 0.12, duration: 0.3 }}
              className="leading-relaxed"
            >
              {s.kind !== 'fact' ? (
                <span className="mr-1 rounded bg-blush px-1 text-[10px] font-bold uppercase text-plum">
                  {t(`assistant.kind.${s.kind}`)}
                </span>
              ) : null}
              {linkify(s.text)}
              {s.citations.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onSource(n)}
                  aria-label={t('assistant.sources.open', { n })}
                  className="ml-1 inline-grid h-5 min-w-5 place-items-center rounded-md bg-plum px-1 align-text-top text-[10px] font-bold text-paper hover:bg-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
                >
                  {n}
                </button>
              ))}
            </motion.li>
          ))}
        </ul>
      )}

      {r.needs_clarification && r.intent !== 'clarify' ? (
        <p className="mt-2 font-semibold text-plum">{r.needs_clarification}</p>
      ) : null}
      {r.freshness_note ? (
        <p className="mt-2 rounded-lg bg-gold/20 px-2 py-1.5 text-xs text-plum">
          ⏱ {r.freshness_note}
        </p>
      ) : null}
      {r.suggested_next_steps.length > 0 && !r.emergency ? (
        <ul className="mt-2 space-y-0.5 text-xs text-plum">
          {r.suggested_next_steps.map((s) => (
            <li key={s}>→ {linkify(s)}</li>
          ))}
        </ul>
      ) : null}
      {r.notices.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-mist">
          {r.notices.map((n) => (
            <li key={n}>ⓘ {n}</li>
          ))}
        </ul>
      ) : null}
      {r.citations.length > 0 ? (
        <button
          type="button"
          onClick={() => onSource(r.citations[0]?.n ?? 1)}
          className="mt-2 text-xs font-semibold text-rose underline-offset-4 hover:underline"
        >
          {t('assistant.sources.view', { count: r.citations.length })}
        </button>
      ) : null}
      {r.proposed_patch ? (
        <DiffCard message={m} onApply={onApply} onEdit={onEdit} onDismiss={onDismiss} />
      ) : null}
      {r.mode_label ? <p className="mt-2 text-[10px] text-mist">{r.mode_label}</p> : null}
    </div>
  );
}

export function MessageView({
  m,
  onSource,
  onApply,
  onEdit,
  onDismiss,
  onEmergency,
}: {
  m: ChatMessage;
  onSource: (n: number) => void;
  onApply: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  onEmergency: () => void;
}) {
  const { t } = useTranslation();
  if (m.role === 'user') {
    return (
      <div className="ml-6 self-end rounded-2xl rounded-tr-sm bg-plum px-3 py-2 text-sm text-paper">
        <span className="sr-only">{t('assistant.you')}: </span>
        {m.text}
      </div>
    );
  }
  if (m.role === 'assistant') {
    return (
      <AssistantBubble
        m={m}
        onSource={onSource}
        onApply={onApply}
        onEdit={onEdit}
        onDismiss={onDismiss}
      />
    );
  }
  if (m.kind === 'nearby') {
    const places = (m.data as NearbyPlace[] | undefined) ?? [];
    return (
      <div className="rounded-2xl border border-blush bg-white/90 p-3 text-sm">
        <p className="font-semibold text-plum">{m.text}</p>
        {places.length === 0 ? (
          <p className="mt-1 text-xs text-mist">{t('assistant.nearby.none')}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {places.map((p) => (
              <li key={p.spot.id} className="flex items-start justify-between gap-2 text-xs">
                <span>
                  <span className="font-semibold text-plum">{p.spot.name}</span>
                  <span className="block text-mist">
                    {p.spot.area} ·{' '}
                    {p.suits ? t('assistant.nearby.suits') : t('assistant.nearby.check')} ·{' '}
                    {t(`status.${p.spot.status === 'sample' ? 'sample' : 'needsReview'}`)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-plum">
                  {t('assistant.nearby.km', { km: p.km.toFixed(1) })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-mist">{t('assistant.nearby.note')}</p>
      </div>
    );
  }
  return (
    <div
      role={m.kind === 'error' ? 'alert' : undefined}
      className="rounded-2xl bg-torii/10 p-3 text-xs text-torii"
    >
      {m.kind === 'error'
        ? t(`assistant.errors.${m.text}`, { defaultValue: t('assistant.errors.unknown') })
        : m.text}
      {m.kind === 'error' ? (
        <button
          type="button"
          onClick={onEmergency}
          className="ml-1 font-semibold underline underline-offset-2"
        >
          {t('assistant.emergency.button')}
        </button>
      ) : null}
    </div>
  );
}

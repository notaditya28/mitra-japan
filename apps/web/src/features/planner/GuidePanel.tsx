import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AssistantChat } from '../assistant/AssistantChat';
import { usePlannerStore } from './usePlannerStore';

const MODE_STYLE = {
  live: 'bg-matcha/35 text-plum',
  demo: 'bg-gold/35 text-plum',
  offline: 'bg-sakura/20 text-rose',
} as const;

/** The AI trip guide: ask for a trip, watch it plan, then ask for changes. */
export function GuidePanel() {
  const { t } = useTranslation();
  const phase = usePlannerStore((s) => s.phase);
  const stage = usePlannerStore((s) => s.stage);
  const previews = usePlannerStore((s) => s.previews.length);
  const expected = usePlannerStore((s) => s.expectedDays);
  const itinerary = usePlannerStore((s) => s.itinerary);
  const error = usePlannerStore((s) => s.error);
  const mode = usePlannerStore((s) => s.mode);
  const plan = usePlannerStore((s) => s.plan);
  const clear = usePlannerStore((s) => s.clear);
  const checkMode = usePlannerStore((s) => s.checkMode);
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const busy = phase === 'planning';
  const changing = itinerary !== null && !busy;
  const suggestions = t('guide.suggestions', { returnObjects: true }) as string[];

  useEffect(() => {
    void checkMode();
  }, [checkMode]);

  // The indicator reflects what is actually on screen, not just the server mode.
  const shownMode = itinerary?.source === 'live' ? 'live' : (mode ?? 'demo');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const prompt = text.trim();
    if (prompt.length < 2 || busy) return;
    void plan(prompt, { change: changing });
    setText('');
  };

  const statusText =
    stage === 'retrying' || stage === 'invalid'
      ? t('guide.retrying')
      : previews === 0
        ? t('guide.planningStart')
        : t('guide.planning', {
            n: Math.min(previews + 1, expected ?? previews + 1),
            total: expected ?? '…',
          });

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="font-display text-2xl text-plum">
          {t('guide.title')}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${MODE_STYLE[shownMode]}`}
          title={t(`guide.modeExplain.${shownMode}`)}
        >
          {t(`guide.mode.${shownMode}`)}
        </span>
      </div>
      {shownMode !== 'live' ? (
        <p className="text-xs text-mist">{t(`guide.modeExplain.${shownMode}`)}</p>
      ) : null}

      {/* Before there's a plan, the guide plans a whole trip; after that, changes go through the
          assistant as small, previewed patches instead of a full re-plan. */}
      {!changing ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={id} className="text-sm font-semibold text-plum">
            {changing ? t('guide.changeLabel') : t('guide.label')}
          </label>
          <textarea
            ref={box}
            id={id}
            value={text}
            rows={2}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e);
            }}
            placeholder={changing ? t('guide.changePlaceholder') : t('guide.placeholder')}
            className="resize-none rounded-2xl border border-petal bg-white/80 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-rose focus:ring-2 focus:ring-rose/30"
          />
          {!changing ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setText(s);
                    // Ready to submit with Enter, or to edit first.
                    box.current?.focus();
                  }}
                  className="rounded-full border border-petal bg-blush px-2.5 py-1 text-xs font-medium text-plum transition hover:border-rose"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={busy || text.trim().length < 2}
            className="btn-primary !py-2.5 text-sm disabled:opacity-50"
          >
            {changing ? t('guide.submitChange') : t('guide.submit')}
          </button>
        </form>
      ) : null}

      <div aria-live="polite" className="min-h-[1.25rem] text-sm">
        {busy ? (
          <p className="flex items-center gap-2 text-plum">
            <span aria-hidden="true" className="h-2 w-2 animate-ping rounded-full bg-sakura" />
            {statusText}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl bg-torii/10 px-3 py-2 text-xs text-torii">
            {t(`guide.errors.${error.code}`, { s: error.retryAfter ?? 60 })}
          </p>
        ) : null}
      </div>

      <AssistantChat />

      {itinerary && !busy ? (
        <button
          type="button"
          onClick={clear}
          className="self-start text-xs font-semibold text-rose underline-offset-4 hover:underline"
        >
          {t('guide.newTrip')}
        </button>
      ) : null}
    </section>
  );
}

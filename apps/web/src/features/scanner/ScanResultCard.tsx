import { useTranslation } from 'react-i18next';
import { VerdictPill } from '../../components/VerdictPill';
import { useAppStore } from '../../store/useAppStore';
import { practicalAdvice, uncertaintyNotes } from './analysis';
import { explainScan } from './explain';
import type { ScanResult, Verdict } from './matchIngredients';
import type { ScanExplanation } from './scanApi';

const RULE_STYLE = {
  avoid: 'bg-torii/10 text-torii',
  ask: 'bg-gold/25 text-plum',
  none: 'bg-white text-ink',
} as const;

export type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; explanation: ScanExplanation }
  | { status: 'error'; code: string };

/** The scan outcome: one of three states, always with its cause and the caveat. */
export function ScanResultCard({
  result,
  verdict,
  lowConfidence,
  sample,
  ai,
  onExplain,
  onStaffCard,
}: {
  result: ScanResult;
  verdict: Verdict;
  lowConfidence: boolean;
  sample: boolean;
  ai: AiState;
  onExplain: () => void;
  onStaffCard: () => void;
}) {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const notes = uncertaintyNotes(result, verdict, lowConfidence);
  const advice = practicalAdvice(result, verdict, diet);
  const ruleLabel = (rule: 'avoid' | 'ask' | null) =>
    rule === 'avoid'
      ? t('scanner.rule.avoid')
      : rule === 'ask'
        ? t('scanner.rule.ask')
        : t('scanner.rule.none');

  return (
    <section
      aria-labelledby="scan-result-title"
      aria-live="polite"
      className="rounded-2xl border border-blush bg-white/80 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="scan-result-title" className="font-display text-xl text-plum">
          {t('scanner.resultTitle')}
        </h3>
        <div className="flex items-center gap-2">
          {sample ? (
            <span className="rounded-full bg-mist/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mist">
              {t('scanner.demoLabel')}
            </span>
          ) : null}
          <VerdictPill verdict={verdict} />
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold text-plum">
        {lowConfidence ? t('scanner.explain.lowConfidence') : explainScan(result, t)}
      </p>

      {result.matches.length > 0 ? (
        <ul className="mt-3 space-y-1.5" aria-label={t('scanner.found')}>
          {result.matches.map((m) => (
            <li
              key={m.ingredient.id}
              className={`rounded-xl px-3 py-2 text-sm ${RULE_STYLE[m.rule ?? 'none']}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span lang="ja" className="font-semibold">
                    {m.term}
                  </span>{' '}
                  <span className="text-xs opacity-80">· {m.ingredient.en}</span>
                </span>
                <span className="shrink-0 text-xs font-bold">{ruleLabel(m.rule)}</span>
              </div>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide opacity-70">
                {t(`scanner.severity.${m.severity}`)} · {t(`scanner.matchedBy.${m.matchedBy}`)}
              </p>
              {m.rule === 'ask' && m.ingredient.ambiguity ? (
                <p className="mt-1 text-xs text-mist">{m.ingredient.ambiguity}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {result.unknown.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-plum">{t('scanner.unknownTitle')}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {result.unknown.slice(0, 12).map((w) => (
              <li
                key={w}
                lang="ja"
                className="rounded-full bg-gold/25 px-2 py-0.5 text-xs text-plum"
              >
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-plum">{t('scanner.notesTitle')}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink">
            {notes.map((n, i) => (
              <li key={`${n.key}-${i}`}>{t(n.key, n.values)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-xs font-semibold text-plum">{t('scanner.adviceTitle')}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink">
          {advice.map((n) => (
            <li key={n.key}>{t(n.key, n.values)}</li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs leading-snug text-mist">{t('scanner.caveat')}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onStaffCard} className="btn-primary !px-5 !py-2.5 text-sm">
          {t('scanner.staff.open')}
        </button>
        {result.reason !== 'unreadable' ? (
          <button
            type="button"
            onClick={onExplain}
            disabled={ai.status === 'loading'}
            className="btn-ghost !px-5 !py-2.5 text-sm text-plum disabled:opacity-60"
          >
            {ai.status === 'loading' ? t('scanner.ai.loading') : t('scanner.ai.button')}
          </button>
        ) : null}
      </div>

      {ai.status === 'done' ? (
        <div className="mt-4 rounded-xl bg-blush/60 p-3 text-sm text-ink">
          <p className="text-[10px] font-bold uppercase tracking-wide text-rose">
            {t('scanner.ai.label')}
          </p>
          <p className="mt-1">{ai.explanation.explanation}</p>
        </div>
      ) : null}
      {ai.status === 'error' ? (
        <p role="alert" className="mt-3 text-xs font-semibold text-torii">
          {t(`scanner.ai.errors.${ai.code}`, { defaultValue: t('scanner.ai.errors.unknown') })}
        </p>
      ) : null}
    </section>
  );
}

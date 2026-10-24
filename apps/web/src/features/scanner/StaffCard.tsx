import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { useAppStore } from '../../store/useAppStore';
import { phraseForDiet } from '../fears/phrases';
import type { ScanResult } from './matchIngredients';
import type { ScanExplanation } from './scanApi';
import { containsQuestionJa, customLineJa, termsToAsk } from './staffQuestions';

interface JaLine {
  ja: string;
  romaji?: string;
  size: 'lg' | 'md';
  tone?: 'rose';
}

function Line({ line }: { line: JaLine }) {
  return (
    <div>
      <p
        className={`font-display leading-snug ${line.tone === 'rose' ? 'text-rose' : 'text-plum'} ${
          line.size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
        }`}
      >
        {line.ja}
      </p>
      {line.romaji ? (
        <p lang="ja-Latn" className="mt-1 text-sm italic text-mist">
          {line.romaji}
        </p>
      ) : null}
    </div>
  );
}

/** Renders its children only for printing, then opens the print dialog. */
function PrintOnce({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  useEffect(() => {
    window.addEventListener('afterprint', onDone, { once: true });
    const id = window.setTimeout(() => void document.fonts.ready.then(() => window.print()), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', onDone);
    };
  }, [onDone]);
  return createPortal(
    <article id="print-root" className="print-doc">
      {children}
    </article>,
    document.body,
  );
}

/**
 * Full-screen waiter card to hand to staff (team guide: printable, with romaji):
 * the diet sentence, a Jain request where relevant, a question about the specific
 * items on this menu, and the traveller's own restrictions.
 */
export function StaffCard({
  open,
  onClose,
  result,
  ai,
}: {
  open: boolean;
  onClose: () => void;
  result: ScanResult | null;
  ai: ScanExplanation | null;
}) {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const custom = useAppStore((s) => s.customRestrictions);
  const phrase = phraseForDiet(diet);
  const terms = termsToAsk(result);
  const question = ai?.askStaffJa ?? containsQuestionJa(terms);
  const questionEn =
    ai?.askStaffEn ??
    (terms.length > 0
      ? t('scanner.staff.containsEn', {
          // Same order as the Japanese question.
          items: terms
            .map((term) => result?.matches.find((m) => m.term === term)?.ingredient.en ?? term)
            .join(', '),
        })
      : null);
  const customJa = customLineJa(custom);
  const [printing, setPrinting] = useState(false);
  const request = phrase && 'request' in phrase ? phrase.request : undefined;
  const lines: JaLine[] = [
    ...(phrase ? [{ ja: phrase.ja, romaji: phrase.romaji, size: 'lg' as const }] : []),
    ...(request ? [{ ja: request.ja, romaji: request.romaji, size: 'md' as const }] : []),
    ...(customJa ? [{ ja: customJa, size: 'md' as const }] : []),
    ...(question ? [{ ja: question, size: 'md' as const, tone: 'rose' as const }] : []),
  ];
  const english = [
    phrase?.en,
    request?.en,
    custom.length > 0
      ? t('scanner.staff.customEn', { items: custom.map((c) => c.label).join(', ') })
      : null,
    questionEn,
  ].filter((x): x is string => Boolean(x));

  return (
    <Dialog open={open} onClose={onClose} title={t('scanner.staff.title')} size="full">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-8">
        <p className="text-sm text-mist">{t('scanner.staff.hint')}</p>
        <div lang="ja" className="space-y-5 rounded-card bg-white p-6 shadow-soft sm:p-8">
          <p className="text-lg text-plum">すみません。</p>
          {lines.map((l, i) => (
            <Line key={i} line={l} />
          ))}
          <p className="text-lg text-plum">よろしくお願いします。</p>
        </div>
        <div className="space-y-1 text-sm text-ink">
          {english.map((e) => (
            <p key={e}>{e}</p>
          ))}
          {ai ? <p className="text-xs text-mist">{t('scanner.staff.aiDrafted')}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setPrinting(true)}
          className="btn-ghost self-start !px-5 !py-2.5 text-sm text-plum"
        >
          {t('scanner.staff.print')}
        </button>
      </div>
      {printing ? (
        <PrintOnce onDone={() => setPrinting(false)}>
          <header className="print-header">
            <p className="print-brand">Mitra Japan · 旅</p>
            <h1>{t('scanner.staff.printTitle')}</h1>
          </header>
          <div lang="ja" className="print-card">
            <p>すみません。</p>
            {lines.map((l, i) => (
              <div key={i}>
                <p className="print-card-ja">{l.ja}</p>
                {l.romaji ? <p className="print-sub">{l.romaji}</p> : null}
              </div>
            ))}
            <p>よろしくお願いします。</p>
          </div>
          {english.map((e) => (
            <p key={e}>{e}</p>
          ))}
          <p className="print-note">{t('scanner.caveat')}</p>
        </PrintOnce>
      ) : null}
    </Dialog>
  );
}

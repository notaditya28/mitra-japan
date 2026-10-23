import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { useAppStore } from '../../store/useAppStore';
import { phraseForDiet } from '../fears/phrases';
import type { ScanResult } from './matchIngredients';
import type { ScanExplanation } from './scanApi';
import { containsQuestionJa, customLineJa, termsToAsk } from './staffQuestions';

/**
 * Full-screen card to hand to staff: the diet sentence, a question about
 * the specific items on this menu, and the traveller's own restrictions.
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

  return (
    <Dialog open={open} onClose={onClose} title={t('scanner.staff.title')} size="full">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-8">
        <p className="text-sm text-mist">{t('scanner.staff.hint')}</p>
        <div lang="ja" className="space-y-5 rounded-card bg-white p-6 shadow-soft sm:p-8">
          <p className="text-lg text-plum">すみません。</p>
          {phrase ? (
            <p className="font-display text-3xl leading-snug text-plum sm:text-4xl">{phrase.ja}</p>
          ) : null}
          {customJa ? (
            <p className="font-display text-2xl leading-snug text-plum">{customJa}</p>
          ) : null}
          {question ? (
            <p className="font-display text-2xl leading-snug text-rose sm:text-3xl">{question}</p>
          ) : null}
          <p className="text-lg text-plum">よろしくお願いします。</p>
        </div>
        <div className="space-y-1 text-sm text-ink">
          {phrase ? <p>{phrase.en}</p> : null}
          {custom.length > 0 ? (
            <p>{t('scanner.staff.customEn', { items: custom.map((c) => c.label).join(', ') })}</p>
          ) : null}
          {questionEn ? <p>{questionEn}</p> : null}
          {ai ? <p className="text-xs text-mist">{t('scanner.staff.aiDrafted')}</p> : null}
        </div>
      </div>
    </Dialog>
  );
}

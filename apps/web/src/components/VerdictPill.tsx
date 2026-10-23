import { useTranslation } from 'react-i18next';
import type { Verdict } from '../features/scanner/matchIngredients';

const STYLES: Record<Verdict, string> = {
  safe: 'bg-matcha/35 text-plum',
  ask: 'bg-gold/40 text-plum',
  avoid: 'bg-torii text-white',
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const { t } = useTranslation();
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STYLES[verdict]}`}>
      {t(`scanner.verdict.${verdict}`)}
    </span>
  );
}

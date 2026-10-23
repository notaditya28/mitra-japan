import { useTranslation } from 'react-i18next';
import type { Verdict } from '../features/scanner/matchIngredients';

const STYLES: Record<Verdict, string> = {
  clear: 'bg-matcha/35 text-plum',
  unverified: 'bg-gold/40 text-plum',
  conflict: 'bg-torii text-white',
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const { t } = useTranslation();
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${STYLES[verdict]}`}
    >
      {t(`scanner.verdict.${verdict}`)}
    </span>
  );
}

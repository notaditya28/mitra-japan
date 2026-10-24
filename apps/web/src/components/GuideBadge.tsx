import { useTranslation } from 'react-i18next';

/**
 * Marks a fact taken as written from the team's system guide (owner decision,
 * 2026-10-24): visible, never presented as verified or official.
 */
export function GuideBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      title={t('guideBadge.note')}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-gold/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-plum ${className}`}
    >
      {t('guideBadge.label')}
    </span>
  );
}

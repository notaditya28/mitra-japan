import { useTranslation } from 'react-i18next';

export type RecordStatus = 'verified' | 'sample' | 'needs-review' | 'estimate';

const STYLE: Record<RecordStatus, string> = {
  verified: 'bg-matcha/35 text-plum',
  sample: 'bg-mist/15 text-mist',
  'needs-review': 'bg-gold/30 text-plum',
  estimate: 'bg-blush text-plum',
};

const KEY: Record<RecordStatus, string> = {
  verified: 'status.verified',
  sample: 'status.sample',
  'needs-review': 'status.needsReview',
  estimate: 'status.estimate',
};

/** Visible data-status badge (owner rule: every seeded record shows its status). */
export function StatusBadge({
  status,
  className = '',
}: {
  status: RecordStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      title={status === 'needs-review' ? t('status.needsReviewNote') : undefined}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STYLE[status]} ${className}`}
    >
      {t(KEY[status])}
    </span>
  );
}

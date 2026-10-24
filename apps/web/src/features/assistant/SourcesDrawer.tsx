import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { StatusBadge } from '../../components/StatusBadge';
import { safeUrl, statusOf } from './model';
import type { Citation, Confidence } from './types';

const CONF_STYLE: Record<Confidence, string> = {
  high: 'bg-matcha/35 text-plum',
  medium: 'bg-gold/35 text-plum',
  low: 'bg-petal text-plum',
  abstained: 'bg-mist/15 text-mist',
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const { t } = useTranslation();
  return (
    <span
      title={t(`assistant.confidenceHelp.${level}`)}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CONF_STYLE[level]}`}
    >
      <span aria-hidden="true" className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              (level === 'high' ? 3 : level === 'medium' ? 2 : level === 'low' ? 1 : 0) > i
                ? 'bg-current'
                : 'bg-current/25'
            }`}
          />
        ))}
      </span>
      {t(`assistant.confidence.${level}`)}
    </span>
  );
}

export function SourcesDrawer({
  citations,
  focus,
  open,
  onClose,
}: {
  citations: Citation[];
  focus: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('assistant.sources.title')}
      eyebrow={t('assistant.sources.eyebrow')}
    >
      <p className="mb-4 text-sm text-mist">{t('assistant.sources.intro')}</p>
      <ol className="space-y-3">
        {citations.map((c) => {
          const url = safeUrl(c.source_url);
          return (
            <li
              key={c.n}
              id={`source-${c.n}`}
              className={`rounded-2xl border p-4 ${c.n === focus ? 'border-rose bg-blush/50' : 'border-blush bg-white/80'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-plum">
                  <span className="mr-2 rounded-md bg-plum px-1.5 py-0.5 text-xs text-paper">
                    {c.n}
                  </span>
                  {c.title}
                </p>
                <StatusBadge status={statusOf(c)} />
              </div>
              {c.section ? <p className="mt-1 text-xs text-mist">{c.section}</p> : null}
              <p className="mt-2 text-sm text-ink">{c.excerpt}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-mist">{t('assistant.sources.source')}</dt>
                <dd className="text-ink">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-rose underline-offset-4 hover:underline"
                    >
                      {c.source_name}
                      <span className="sr-only"> ({t('restaurants.newTab')})</span>
                    </a>
                  ) : (
                    c.source_name
                  )}
                </dd>
                <dt className="text-mist">{t('assistant.sources.type')}</dt>
                <dd className="text-ink">
                  {t(`assistant.sourceTypes.${c.source_type}`, { defaultValue: c.source_type })}
                </dd>
                <dt className="text-mist">{t('assistant.sources.verified')}</dt>
                <dd className="text-ink">
                  {c.last_verified ?? t('assistant.sources.never')}
                  {c.volatility === 'volatile' ? ` · ${t('assistant.sources.volatile')}` : ''}
                </dd>
              </dl>
            </li>
          );
        })}
      </ol>
    </Dialog>
  );
}

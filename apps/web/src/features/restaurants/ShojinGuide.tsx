import { useTranslation } from 'react-i18next';
import shojin from '../../data/shojin.json';
import { GuideBadge } from '../../components/GuideBadge';
import { StatusBadge } from '../../components/StatusBadge';

/**
 * Shojin ryori, Zen temple cuisine (team guide section 3.7): what it is, where to try it,
 * what to ask. Points summarised from JNTO carry its link; team-guide points carry the badge.
 */
export function ShojinGuide() {
  const { t } = useTranslation();
  return (
    <details className="rounded-2xl border border-blush bg-white/80 p-4 text-sm">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 font-semibold text-plum">
        <span lang="ja" className="font-display">
          精進料理
        </span>
        {t('shojin.title')}
        <StatusBadge status="needs-review" />
      </summary>
      <div className="mt-3 space-y-3">
        {shojin.sections.map((s) => (
          <section key={s.id}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-plum">
              {t(`shojin.sections.${s.id}`, { defaultValue: s.title })}
            </h3>
            <ul className="mt-1 space-y-1">
              {s.points.map((p) => (
                <li key={p.text} className="text-ink">
                  {p.text}{' '}
                  {p.source === 'team-guide' ? <GuideBadge className="ml-1 align-middle" /> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-xs text-mist">
          {t('shojin.source')}{' '}
          {shojin.links.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-rose underline-offset-4 hover:underline"
            >
              {l.label}
              <span className="sr-only"> ({t('restaurants.newTab')})</span>
            </a>
          ))}
        </p>
      </div>
    </details>
  );
}

import { useTranslation } from 'react-i18next';
import statsData from '../../data/stats.json';
import { Counter } from '../Counter';
import { Seigaiha } from '../motifs/Seigaiha';
import { SectionHeader } from './SectionHeader';

interface Stat {
  id: string;
  value: number | null;
  suffix: string;
  label: string;
  source: string;
  sourceUrl: string;
  verified: boolean;
}

const stats: Stat[] = statsData.stats;

export function NumbersSection() {
  const { t } = useTranslation();
  return (
    <section id="numbers" aria-labelledby="numbers-title" className="relative isolate text-paper">
      <Seigaiha bg="#4A2238" line="#FFF8FA" lineOpacity={0.06} className="absolute inset-0 -z-10" />
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
        <SectionHeader
          id="numbers-title"
          dark
          eyebrow={t('numbers.eyebrow')}
          title={t('numbers.title')}
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <li key={s.id} className="card-dark flex flex-col p-6">
              <p className="font-display text-5xl text-gold">
                {s.value === null ? (
                  <span aria-label={t('numbers.pending')}>—</span>
                ) : (
                  <Counter value={s.value} suffix={s.suffix} />
                )}
              </p>
              <p className="mt-3 text-sm text-blush/85">{s.label}</p>
              <p className="mt-auto pt-5 text-xs text-blush/70">
                {t('numbers.source')}:{' '}
                {s.sourceUrl ? (
                  <a
                    href={s.sourceUrl}
                    className="underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.source}
                  </a>
                ) : (
                  s.source
                )}
                {!s.verified ? (
                  <span className="ml-1 text-gold"> · {t('numbers.pending')}</span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import { useTranslation } from 'react-i18next';
import heritage from '../../data/heritage.json';
import { SectionHeader } from './SectionHeader';

export function RootsSection() {
  const { t } = useTranslation();
  return (
    <section id="roots" aria-labelledby="roots-title" className="bg-paper">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
        <SectionHeader
          id="roots-title"
          eyebrow={t('roots.eyebrow')}
          title={t('roots.title')}
          body={t('roots.body')}
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {heritage.deities.map((d) => (
            <li key={d.id} className="card relative overflow-hidden p-6">
              <span
                aria-hidden="true"
                lang="ja"
                className="absolute -right-2 -top-4 font-display text-7xl text-gold/25"
              >
                {d.kanji.charAt(0)}
              </span>
              <p className="eyebrow text-mist">{d.japanese}</p>
              <p className="mt-1 font-display text-2xl text-plum">{d.indian}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink">{d.story}</p>
              <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-mist">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-gold" />
                {d.place}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

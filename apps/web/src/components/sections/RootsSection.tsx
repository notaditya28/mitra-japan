import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import heritage from '../../data/heritage.json';

// Map data + d3-geo load with the reveal, not with first paint.
const RootsReveal = lazy(() =>
  import('../../features/roots/RootsReveal').then((m) => ({ default: m.RootsReveal })),
);

/**
 * Indian roots: the scroll-driven mosaic-to-map reveal, then the story cards
 * (the accessible, readable version of the same facts).
 */
export function RootsSection({ immersive }: { immersive: boolean }) {
  const { t } = useTranslation();
  return (
    <div id="roots" className="bg-paper">
      <Suspense
        // Same height as the reveal so nothing below shifts when it arrives.
        fallback={<div style={{ height: immersive ? '360vh' : '100svh' }} aria-hidden="true" />}
      >
        <RootsReveal scrubbed={immersive} />
      </Suspense>
      <section
        aria-labelledby="stories-title"
        className="mx-auto max-w-7xl px-4 pb-24 sm:px-8 sm:pb-32"
      >
        <h3 id="stories-title" className="display mb-8 text-3xl text-plum sm:text-4xl">
          {t('roots.storiesTitle')}
        </h3>
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
              <p className="mt-1 font-display text-2xl text-plum">{t(`roots.indian.${d.id}`)}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink">{d.story}</p>
              <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-mist">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-gold" />
                {d.place}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

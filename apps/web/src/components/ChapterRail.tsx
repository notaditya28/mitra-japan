import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { getLenis } from '../lib/smoothScroll';
import { PLACES, stage } from '../scenes/journeyState';
import { VH_PER_PLACE } from './sections/PlacesSection';

const CHAPTERS = [
  { id: 'fuji', kanji: '富士' },
  ...PLACES.map((p) => ({ id: p.id, kanji: p.kanji })),
];

/**
 * Numbered chapter rail (00 富士 … 04 祭り). Highlights the active scene and
 * jumps to any chapter. Reads the shared stage on the GSAP ticker and only
 * re-renders when the chapter changes.
 */
export function ChapterRail() {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const tick = () => setActive((a) => (a === stage.scene ? a : stage.scene));
    gsap.ticker.add(tick);
    const el = document.getElementById('journey');
    const io = el ? new IntersectionObserver(([e]) => setVisible(e?.isIntersecting ?? true)) : null;
    if (el) io?.observe(el);
    return () => {
      gsap.ticker.remove(tick);
      io?.disconnect();
    };
  }, []);

  const go = (i: number) => {
    let y = 0;
    const places = document.getElementById('places');
    if (i > 0 && places)
      y = places.offsetTop + ((i - 1 + 0.32) * VH_PER_PLACE * window.innerHeight) / 100;
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(y, { duration: 2.2 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <nav
      aria-label={t('places.rail')}
      className={`fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 transition-opacity duration-500 lg:block ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <ol className="flex flex-col items-end gap-3">
        {CHAPTERS.map((c, i) => {
          const on = i === active;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={on ? 'step' : undefined}
                className={`group flex flex-row-reverse items-center gap-3 rounded-full py-1 pl-3 text-right text-xs font-semibold transition-all duration-500 ${
                  on ? 'text-paper' : 'text-paper/55 hover:text-paper/90'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-px transition-all duration-500 ${on ? 'w-8 bg-gold' : 'w-4 bg-paper/50'}`}
                />
                <span className="tabular-nums">{String(i).padStart(2, '0')}</span>
                <span lang="ja" className="font-display text-sm">
                  {c.kanji}
                </span>
                <span
                  className={`transition-opacity duration-500 ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  {t(`places.${c.id}.name`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

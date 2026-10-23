import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scrollToId } from '../lib/smoothScroll';

const LINKS = [
  { id: 'fears', key: 'nav.why' },
  { id: 'roots', key: 'nav.roots' },
  { id: 'numbers', key: 'nav.numbers' },
] as const;

export function Nav() {
  const { t } = useTranslation();
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-500 ease-calm ${
        solid ? 'border-b border-blush bg-paper/85 text-plum backdrop-blur-md' : 'text-paper'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
        <a
          href="#top"
          className="flex items-center gap-2.5 font-semibold"
          aria-label={t('nav.home')}
        >
          <img src="/favicon.svg" alt="" width="32" height="32" className="rounded-lg" />
          <span className="font-display text-lg">Mitra Japan</span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollToId(l.id)}
              className="hidden rounded-full px-3 py-2 text-sm font-medium opacity-90 transition hover:opacity-100 md:inline-flex"
            >
              {t(l.key)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => scrollToId('cta')}
            className="btn-primary !px-5 !py-2 text-sm"
          >
            {t('nav.cta')}
          </button>
        </div>
      </div>
    </nav>
  );
}

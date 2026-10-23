import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startTrip } from '../features/auth/startTrip';
import { navigate, type View } from '../lib/router';
import { scrollToId } from '../lib/smoothScroll';
import { playPortal } from '../lib/portal';
import { LanguageSwitch } from './LanguageSwitch';

const LINKS = [
  { id: 'places', key: 'nav.why' },
  { id: 'roots', key: 'nav.roots' },
  { id: 'numbers', key: 'nav.numbers' },
] as const;

export function Nav({ view }: { view: View }) {
  const { t } = useTranslation();
  const [scrolled, setSolid] = useState(false);
  const onJourney = view === 'journey';
  const solid = scrolled || !onJourney;

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
          onClick={(e) => {
            if (onJourney) return;
            e.preventDefault();
            playPortal(() => navigate('journey'));
          }}
          className="flex items-center gap-2.5 font-semibold"
          aria-label={t('nav.home')}
        >
          <img src="/favicon.svg" alt="" width="32" height="32" className="rounded-lg" />
          <span className="whitespace-nowrap font-display text-lg">Mitra Japan</span>
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          {!onJourney ? (
            <button
              type="button"
              onClick={() => playPortal(() => navigate('journey'))}
              aria-label={t('nav.back')}
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium opacity-90 transition hover:opacity-100"
            >
              ← <span className="hidden sm:inline">{t('nav.back')}</span>
            </button>
          ) : null}
          {(onJourney ? LINKS : []).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollToId(l.id)}
              className="hidden rounded-full px-3 py-2 text-sm font-medium opacity-90 transition hover:opacity-100 md:inline-flex"
            >
              {t(l.key)}
            </button>
          ))}
          <LanguageSwitch solid={solid} />
          {onJourney ? (
            <button
              type="button"
              onClick={startTrip}
              className="btn-primary hidden !px-5 !py-2 text-sm sm:inline-flex"
            >
              {t('nav.cta')}
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

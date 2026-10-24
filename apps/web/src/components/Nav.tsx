import { lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { startTrip } from '../features/auth/startTrip';
import { navigate, type View } from '../lib/router';
import { playPortal } from '../lib/portal';
import { LanguageSwitch } from './LanguageSwitch';
import { SectionNav } from './SectionNav';

const AskMitraButton = lazy(() => import('../features/planner/AskMitraButton'));

/**
 * One-row top bar: brand, section links (scroll sideways when they don't fit), language
 * and the CTA. On the journey it stays transparent the whole way down (owner request,
 * 2026-10-24); each control sits on its own frosted pill so it reads over dark photos
 * and light paper sections alike. App pages (sign-in, planner) keep a solid bar.
 */
export function Nav({ view }: { view: View }) {
  const { t } = useTranslation();
  const onJourney = view === 'journey';
  const solid = !onJourney;
  const bar = useRef<HTMLElement>(null);

  // Pages leave room for the bar through --nav-h.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <nav
      ref={bar}
      aria-label="Main"
      className={`fixed inset-x-0 top-0 z-40 ${
        solid ? 'border-b border-blush bg-paper/85 text-plum backdrop-blur-md' : 'text-paper'
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        <a
          href="#top"
          onClick={(e) => {
            if (onJourney) return;
            e.preventDefault();
            playPortal(() => navigate('journey'));
          }}
          className={`flex shrink-0 items-center gap-2 rounded-full font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            solid
              ? 'focus-visible:outline-rose'
              : 'bg-plum/65 p-1 pr-1 shadow-soft backdrop-blur-md focus-visible:outline-gold sm:pr-3'
          }`}
          aria-label={t('nav.home')}
        >
          <img src="/favicon.svg" alt="" width="32" height="32" className="rounded-lg" />
          <span className="hidden whitespace-nowrap font-display text-lg sm:inline">
            Mitra Japan
          </span>
        </a>
        {!onJourney ? (
          <button
            type="button"
            onClick={() => playPortal(() => navigate('journey'))}
            aria-label={t('nav.back')}
            className="shrink-0 whitespace-nowrap rounded-full px-2 py-2 text-sm font-medium opacity-90 transition hover:opacity-100"
          >
            ← <span className="hidden xl:inline">{t('nav.back')}</span>
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <SectionNav view={view} solid={solid} />
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {view === 'plan' ? (
            <Suspense fallback={null}>
              <AskMitraButton />
            </Suspense>
          ) : null}
          <LanguageSwitch solid={solid} />
          {onJourney ? (
            <button
              type="button"
              onClick={startTrip}
              className="btn-primary hidden !px-5 !py-2 text-sm shadow-soft md:inline-flex"
            >
              {t('nav.cta')}
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

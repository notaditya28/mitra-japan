import { useTranslation } from 'react-i18next';
import { PersonaPicker } from '../../features/persona/PersonaPicker';
import { scrollToId } from '../../lib/smoothScroll';

/**
 * First screen: who is travelling. In the immersive layout the 3D map of India,
 * with the plane parked at Delhi, sits behind it; scrolling on starts the flight.
 */
export function Welcome({ immersive }: { immersive: boolean }) {
  const { t } = useTranslation();
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className={`relative isolate flex min-h-[100svh] items-center text-paper ${
        immersive ? '' : 'bg-plum'
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-plum/55 via-transparent to-plum/45"
      />
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-8">
        <header className="mx-auto mb-10 max-w-3xl text-center [text-shadow:0_2px_24px_rgb(46_20_36/0.5)]">
          <p className="eyebrow mb-4 text-gold">{t('hero.eyebrow')}</p>
          <h1 id="hero-title" className="display text-5xl sm:text-7xl">
            {t('hero.title')}
          </h1>
          <p className="mt-4 font-display text-2xl text-blush sm:text-3xl">{t('hero.tagline')}</p>
          <h2 className="mt-8 text-lg font-semibold text-paper sm:text-xl">
            {t('tour.welcome.pick')}
          </h2>
          <p className="mt-2 text-sm text-blush/85">{t('persona.body')}</p>
        </header>
        <PersonaPicker />
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => scrollToId('tour')}
            className="btn-primary [text-shadow:none]"
          >
            {t('tour.welcome.cta')}
          </button>
        </div>
      </div>
      <div className="eyebrow absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 font-medium text-paper/85">
        <span>{t('tour.welcome.scroll')}</span>
        <span aria-hidden="true" className="scroll-cue block h-10 w-px bg-paper/60" />
      </div>
    </section>
  );
}

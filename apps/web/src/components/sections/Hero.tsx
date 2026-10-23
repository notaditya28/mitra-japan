import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Fuji } from '../motifs/Fuji';
import { SunDisc } from '../motifs/SunDisc';
import { Petals2D } from '../motifs/Petals2D';
import { getDeviceProfile } from '../../lib/device';
import { useReducedMotion } from '../../lib/hooks';
import { scrollToId } from '../../lib/smoothScroll';

const HeroPetals3D = lazy(() => import('../../scenes/HeroPetals3D'));

export function Hero() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const { webgl, tier } = getDeviceProfile();
  const use3D = webgl && tier !== 'low' && !reduced;

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-plum text-paper"
    >
      {/* Dawn sky */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20"
        style={{
          background:
            'linear-gradient(180deg, #2E1424 0%, #4A2238 34%, #8A3A5C 62%, #D9577F 80%, #F0C27B 100%)',
        }}
      />
      <SunDisc className="hero-sun absolute left-1/2 top-[44%] -z-10 w-[min(60vw,360px)] -translate-x-1/2" />
      <span
        aria-hidden="true"
        lang="ja"
        className="absolute right-[6%] top-[18%] -z-10 hidden font-display text-[14rem] leading-none text-paper/[0.06] lg:block"
      >
        友
      </span>
      <Fuji className="absolute inset-x-0 bottom-0 -z-10 h-[46vh] w-full" />

      {use3D ? (
        <Suspense fallback={<Petals2D className="absolute inset-0 h-full w-full" />}>
          <HeroPetals3D />
        </Suspense>
      ) : (
        <Petals2D className="absolute inset-0 h-full w-full" />
      )}

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-[34vh] pt-24 text-center sm:px-8">
        <p className="eyebrow mb-6 text-gold">{t('hero.eyebrow')}</p>
        <h1 id="hero-title" className="display text-6xl sm:text-8xl lg:text-9xl">
          {t('hero.title')}
        </h1>
        <p className="mt-5 font-display text-2xl text-blush sm:text-4xl">{t('hero.tagline')}</p>
        <p className="mx-auto mt-6 max-w-xl text-base text-blush/85 sm:text-lg">{t('hero.body')}</p>
        <button type="button" onClick={() => scrollToId('persona')} className="btn-primary mt-9">
          {t('hero.cta')}
        </button>
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-paper/80">
        <span>{t('hero.scroll')}</span>
        <span aria-hidden="true" className="scroll-cue block h-10 w-px bg-paper/60" />
      </div>
    </section>
  );
}

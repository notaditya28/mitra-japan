import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Hero } from './components/sections/Hero';
import { PersonaSection } from './components/sections/PersonaSection';
import { FearsSection } from './components/sections/FearsSection';
import { TunnelSection } from './components/sections/TunnelSection';
import { RootsSection } from './components/sections/RootsSection';
import { NumbersSection } from './components/sections/NumbersSection';
import { CtaSection } from './components/sections/CtaSection';
import { tintFor } from './features/persona/personas';
import { getDeviceProfile } from './lib/device';
import { useReducedMotion } from './lib/hooks';
import { useSmoothScroll } from './lib/smoothScroll';
import { useJourneyTriggers } from './scenes/useJourneyTriggers';
import { useAppStore } from './store/useAppStore';

const JourneyCanvas = lazy(() => import('./scenes/JourneyCanvas'));

export default function App() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const persona = useAppStore((s) => s.persona);
  const { webgl, tier } = getDeviceProfile();
  // The scroll-driven 3D journey; reduced-motion and low-tier devices get the static layout.
  const immersive = webgl && tier !== 'low' && !reduced;

  useSmoothScroll(!reduced);
  useJourneyTriggers(immersive);

  // Persona tints the rest of the journey through a single CSS variable.
  useEffect(() => {
    document.documentElement.style.setProperty('--tint', tintFor(persona));
  }, [persona]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-paper focus:px-4 focus:py-2 focus:text-plum"
      >
        {t('a11y.skip')}
      </a>
      {immersive ? (
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="fixed inset-0 -z-10"
              style={{
                background: 'linear-gradient(180deg, #2E1424 0%, #6E2F52 45%, #E07A8F 100%)',
              }}
            />
          }
        >
          <JourneyCanvas watchId="journey" />
        </Suspense>
      ) : null}
      <Nav />
      <main id="main">
        <div id="journey">
          <Hero immersive={immersive} />
          <PersonaSection immersive={immersive} />
          {immersive ? <TunnelSection /> : <FearsSection />}
        </div>
        {immersive ? (
          // Soft hand-off from the 3D sky into the paper sections below.
          <div
            aria-hidden="true"
            className="pointer-events-none relative -mt-[35vh] h-[35vh] bg-gradient-to-b from-transparent via-paper/60 to-paper"
          />
        ) : null}
        <RootsSection />
        <NumbersSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}

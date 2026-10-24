import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Welcome } from './components/sections/Welcome';
import { FearsSection } from './components/sections/FearsSection';
import { TourSection } from './components/sections/TourSection';
import { ChapterRail } from './components/ChapterRail';
import { CityMapWindow } from './features/tour/CityMapWindow';
import { TourStatic } from './features/tour/TourStatic';
import { SceneErrorBoundary } from './components/SceneErrorBoundary';
import { RootsSection } from './components/sections/RootsSection';
import { NumbersSection } from './components/sections/NumbersSection';
import { CtaSection } from './components/sections/CtaSection';
import { tintFor } from './features/persona/personas';
import { PortalTransition } from './components/PortalTransition';
import { navigate, useView } from './lib/router';
import { getDeviceProfile } from './lib/device';
import { useReducedMotion } from './lib/hooks';
import { useSmoothScroll } from './lib/smoothScroll';
import { useAppStore } from './store/useAppStore';

const JourneyCanvas = lazy(() => import('./scenes/JourneyCanvas'));
const DemoLogin = lazy(() =>
  import('./features/auth/DemoLogin').then((m) => ({ default: m.DemoLogin })),
);
// Media-heavy, below the fold: its own chunk, loaded after first paint.
const GallerySection = lazy(() => import('./components/sections/GallerySection'));
const PlannerPage = lazy(() =>
  import('./features/planner/PlannerPage').then((m) => ({ default: m.PlannerPage })),
);

// Static plum backdrop shown while the 3D chunk loads, or if it fails.
const SKY_FALLBACK = (
  <div
    aria-hidden="true"
    className="fixed inset-0 -z-10"
    style={{ background: 'linear-gradient(180deg, #1A0C18 0%, #3A1A2E 60%, #4A2238 100%)' }}
  />
);

export default function App() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const persona = useAppStore((s) => s.persona);
  const user = useAppStore((s) => s.user);
  const view = useView();
  const onJourney = view === 'journey';
  const { webgl, tier } = getDeviceProfile();
  // The scroll-driven 3D journey; reduced-motion and low-tier devices get the static layout.
  const immersive = webgl && tier !== 'low' && !reduced;

  useSmoothScroll(!reduced);

  // Each page starts at its top (the browser would otherwise restore the old scroll).
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, [view]);

  // The planner needs a (demo) sign-in first.
  useEffect(() => {
    if (view === 'plan' && !user) navigate('login');
  }, [view, user]);

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
      {immersive && onJourney ? (
        <SceneErrorBoundary fallback={SKY_FALLBACK}>
          <Suspense fallback={SKY_FALLBACK}>
            <JourneyCanvas watchId="journey" />
          </Suspense>
        </SceneErrorBoundary>
      ) : null}
      <Nav view={view} />
      {immersive && onJourney ? <ChapterRail /> : null}
      {onJourney ? <CityMapWindow /> : null}
      <Suspense fallback={<div className="min-h-[100svh] bg-paper" />}>
        {view === 'login' ? <DemoLogin /> : null}
        {view === 'plan' && user ? <PlannerPage /> : null}
      </Suspense>
      {onJourney ? (
        <main id="main">
          <div id="journey">
            <Welcome immersive={immersive} />
            {immersive ? <TourSection /> : <TourStatic />}
          </div>
          {immersive ? null : <FearsSection />}
          {immersive ? (
            // Soft hand-off from the 3D sky into the paper sections below.
            <div
              aria-hidden="true"
              className="pointer-events-none relative -mt-[35vh] h-[35vh] bg-gradient-to-b from-transparent via-paper/60 to-paper"
            />
          ) : null}
          <RootsSection immersive={immersive} />
          <Suspense fallback={<div className="h-[100svh] bg-plum" aria-hidden="true" />}>
            {/* The scroll-driven strip needs no WebGL, only motion and a capable device. */}
            <GallerySection scrubbed={tier !== 'low' && !reduced} />
          </Suspense>
          <NumbersSection />
          <CtaSection />
        </main>
      ) : null}
      {view !== 'plan' ? <Footer /> : null}
      <PortalTransition />
    </>
  );
}

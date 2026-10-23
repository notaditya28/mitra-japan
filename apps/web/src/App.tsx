import { useEffect } from 'react';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Hero } from './components/sections/Hero';
import { PersonaSection } from './components/sections/PersonaSection';
import { FearsSection } from './components/sections/FearsSection';
import { RootsSection } from './components/sections/RootsSection';
import { NumbersSection } from './components/sections/NumbersSection';
import { CtaSection } from './components/sections/CtaSection';
import { tintFor } from './features/persona/personas';
import { useReducedMotion } from './lib/hooks';
import { useSmoothScroll } from './lib/smoothScroll';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const reduced = useReducedMotion();
  const persona = useAppStore((s) => s.persona);
  useSmoothScroll(!reduced);

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
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <PersonaSection />
        <FearsSection />
        <RootsSection />
        <NumbersSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}

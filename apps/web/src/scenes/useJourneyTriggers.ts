import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { journey } from './journeyState';

/** Feeds hero and persona scroll progress into the shared journey state. */
export function useJourneyTriggers(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const triggers = [
      ScrollTrigger.create({
        trigger: '#top',
        start: 'top top',
        end: 'bottom top',
        onUpdate: (s) => {
          journey.hero = s.progress;
        },
      }),
      ScrollTrigger.create({
        trigger: '#persona',
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (s) => {
          journey.persona = s.progress;
        },
      }),
    ];
    // Fonts and lazy chunks shift layout after first paint.
    const refresh = () => ScrollTrigger.refresh();
    void document.fonts.ready.then(refresh);
    window.addEventListener('load', refresh);
    return () => {
      triggers.forEach((t) => t.kill());
      window.removeEventListener('load', refresh);
    };
  }, [enabled]);
}

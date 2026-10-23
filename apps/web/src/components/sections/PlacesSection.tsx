import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ToriiGate } from '../motifs/ToriiGate';
import { FoodScanPreview } from '../../features/fears/FoodScanPreview';
import { PhrasePreview } from '../../features/fears/PhrasePreview';
import { VisaChecklist } from '../../features/fears/VisaChecklist';
import { RootsTeaser } from '../../features/fears/RootsTeaser';
import { journey, PLACES, type FearId } from '../../scenes/journeyState';

const PREVIEWS: Record<FearId, ReactNode> = {
  food: <FoodScanPreview />,
  language: <PhrasePreview />,
  visa: <VisaChecklist />,
  foreign: <RootsTeaser />,
};

/** Scroll length per place, in viewport heights. */
export const VH_PER_PLACE = 140;

/** Split into grapheme clusters so Devanagari and Gujarati conjuncts stay intact. */
function graphemes(text: string, lang: string): string[] {
  const Seg = Intl.Segmenter;
  if (typeof Seg === 'function')
    return [...new Seg(lang, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  return [...text];
}

/**
 * The places journey. A tall section with a sticky viewport: scrolling drives
 * `journey.places`, which moves the 3D camera through Tokyo, the Shinkansen,
 * Kyoto and the matsuri (with petal-portal transitions between them). A
 * scrubbed timeline brings in each place's stretched title, then its fear
 * card, flipping it from question to answer at the scene's key moment.
 */
export function PlacesSection() {
  const { t, i18n } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const lang = i18n.language;
  const titles = useMemo(
    () => PLACES.map((p) => graphemes(t(`places.${p.id}.name`), lang)),
    [t, lang],
  );

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          onUpdate: (self) => {
            journey.places = self.progress;
          },
          onLeaveBack: () => {
            journey.places = 0;
          },
        },
      });

      PLACES.forEach((_, i) => {
        const title = el.querySelector<HTMLElement>(`[data-title="${i}"]`);
        const letters = el.querySelectorAll<HTMLElement>(`[data-title="${i}"] [data-letter]`);
        const card = el.querySelector<HTMLElement>(`[data-card="${i}"]`);
        const flip = el.querySelector<HTMLElement>(`[data-card="${i}"] [data-flip]`);
        if (!title || !card || !flip) return;
        gsap.set([title, card], { autoAlpha: 0 });

        // Kelvin-style title: letters arrive stretched tall and relax into place
        // as the torii window finishes opening.
        tl.to(title, { autoAlpha: 1, duration: 0.04 }, i + 0.05);
        tl.fromTo(
          letters,
          { scaleY: 2.6, yPercent: 30, opacity: 0 },
          { scaleY: 1, yPercent: 0, opacity: 1, duration: 0.12, stagger: 0.01, ease: 'power3.out' },
          i + 0.05,
        );
        tl.to(title, { autoAlpha: 0, y: -40, duration: 0.06, ease: 'power2.in' }, i + 0.24);

        tl.fromTo(
          card,
          { autoAlpha: 0, y: 48 },
          { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power3.out' },
          i + 0.27,
        );
        tl.to(flip, { rotateY: 180, duration: 0.13, ease: 'power3.inOut' }, i + 0.42);
        tl.to(card, { autoAlpha: 0, y: -48, duration: 0.06, ease: 'power2.in' }, i + 0.85);
      });
      tl.set({}, {}, PLACES.length);
    }, el);
    return () => ctx.revert();
  }, [titles]);

  return (
    <section
      ref={root}
      id="places"
      aria-labelledby="places-title"
      className="relative"
      style={{ height: `${PLACES.length * VH_PER_PLACE + 100}vh` }}
    >
      <h2 id="places-title" className="sr-only">
        {t('fears.title')}
      </h2>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {PLACES.map((place, i) => (
          <div
            key={place.id}
            data-title={i}
            aria-hidden="true"
            className="invisible absolute inset-x-0 top-[16%] flex flex-col items-center px-4 text-center text-paper [text-shadow:0_4px_30px_rgb(46_20_36/0.5)]"
          >
            <p lang="ja" className="font-display text-2xl text-gold sm:text-3xl">
              {place.kanji}
            </p>
            <p className="display flex text-[clamp(3.5rem,13vw,11rem)] leading-none">
              {(titles[i] ?? []).map((g, j) => (
                <span key={j} data-letter className="inline-block origin-bottom">
                  {g}
                </span>
              ))}
            </p>
            <p className="mt-4 max-w-md text-base text-blush sm:text-lg">
              {t(`places.${place.id}.tagline`)}
            </p>
          </div>
        ))}

        {PLACES.map((place, i) => (
          <article
            key={place.id}
            data-card={i}
            aria-label={t(`fears.items.${place.fear}.q`)}
            className="invisible absolute inset-x-3 bottom-3 [perspective:1400px] sm:inset-x-auto sm:bottom-auto sm:left-[6%] sm:top-1/2 sm:w-[440px] sm:-translate-y-1/2"
          >
            <div data-flip className="grid [transform-style:preserve-3d]">
              <div className="card-dark col-start-1 row-start-1 flex flex-col items-start justify-center gap-4 p-7 [backface-visibility:hidden]">
                <ToriiGate className="h-14 w-16" color="#E0566A" beam="#FFF8FA" />
                <p className="eyebrow text-gold">
                  <span lang="ja">{place.kanji}</span> · {t(`places.${place.id}.name`)}
                </p>
                <h3 className="display text-4xl text-paper sm:text-5xl">
                  {t(`fears.items.${place.fear}.q`)}
                </h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-blush/80">
                  <span
                    aria-hidden="true"
                    className="scroll-cue inline-block h-5 w-px bg-blush/70"
                  />
                  {t('fears.passHint')}
                </p>
              </div>
              <div className="card col-start-1 row-start-1 flex flex-col gap-3 bg-white/95 p-5 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-6">
                <div className="flex items-center gap-3">
                  <ToriiGate className="h-8 w-9 shrink-0" />
                  <div>
                    <p className="eyebrow text-rose">
                      <span lang="ja">{place.kanji}</span> · {t(`places.${place.id}.name`)}
                    </p>
                    <p className="font-display text-xl leading-tight text-plum">
                      {t(`fears.items.${place.fear}.q`)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-ink">{t(`fears.items.${place.fear}.a`)}</p>
                {PREVIEWS[place.fear]}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

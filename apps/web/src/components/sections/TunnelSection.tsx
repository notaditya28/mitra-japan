import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ToriiGate } from '../motifs/ToriiGate';
import { FoodScanPreview } from '../../features/fears/FoodScanPreview';
import { PhrasePreview } from '../../features/fears/PhrasePreview';
import { VisaChecklist } from '../../features/fears/VisaChecklist';
import { RootsTeaser } from '../../features/fears/RootsTeaser';
import { FEAR_IDS, journey, type FearId } from '../../scenes/journeyState';

const PREVIEWS: Record<FearId, ReactNode> = {
  food: <FoodScanPreview />,
  language: <PhrasePreview />,
  visa: <VisaChecklist />,
  foreign: <RootsTeaser />,
};

/** Scroll length per gate, in viewport heights. */
const VH_PER_GATE = 120;

/**
 * The torii tunnel. A tall section with a sticky viewport: scrolling moves the
 * 3D camera through the gates (via `journey.tunnel`) and a scrubbed timeline
 * brings in one fear card per gate, flipping it from question to answer at the
 * moment the camera passes through that gate.
 */
export function TunnelSection() {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('[data-card]');
      const flips = gsap.utils.toArray<HTMLElement>('[data-flip]');
      const dots = gsap.utils.toArray<HTMLElement>('[data-dot]');
      gsap.set(cards, { autoAlpha: 0, y: 48 });

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          onUpdate: (self) => {
            journey.tunnel = self.progress;
          },
          onLeaveBack: () => {
            journey.tunnel = 0;
          },
        },
      });

      tl.to('[data-intro]', { autoAlpha: 0, y: -30, duration: 0.12 }, 0.02);
      tl.fromTo('[data-dots]', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.05);
      cards.forEach((card, i) => {
        const flip = flips[i];
        const dot = dots[i];
        tl.to(card, { autoAlpha: 1, y: 0, duration: 0.16, ease: 'power3.out' }, i + 0.04);
        if (dot) tl.to(dot, { scale: 1.5, backgroundColor: '#D9577F', duration: 0.1 }, i + 0.04);
        if (flip) tl.to(flip, { rotateY: 180, duration: 0.16, ease: 'power3.inOut' }, i + 0.42);
        tl.to(card, { autoAlpha: 0, y: -48, duration: 0.12, ease: 'power2.in' }, i + 0.88);
        if (dot)
          tl.to(
            dot,
            { scale: 1, backgroundColor: 'rgba(255,248,250,0.5)', duration: 0.1 },
            i + 0.9,
          );
      });
      tl.set({}, {}, FEAR_IDS.length);
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={root}
      id="fears"
      aria-labelledby="fears-title"
      className="relative"
      style={{ height: `${FEAR_IDS.length * VH_PER_GATE + 100}vh` }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <header data-intro className="mx-auto max-w-3xl px-4 pt-28 text-center sm:pt-32">
          <p className="eyebrow mb-4 text-gold">{t('fears.eyebrow')}</p>
          <h2 id="fears-title" className="display text-4xl text-paper drop-shadow-sm sm:text-6xl">
            {t('fears.title')}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-blush">{t('fears.body')}</p>
        </header>

        <ol
          data-dots
          aria-hidden="true"
          className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col gap-4 sm:right-8"
        >
          {FEAR_IDS.map((id) => (
            <li key={id} data-dot className="h-2 w-2 rounded-full bg-paper/50" />
          ))}
        </ol>

        {FEAR_IDS.map((id, i) => (
          <article
            key={id}
            data-card
            aria-label={t(`fears.items.${id}.q`)}
            className="invisible absolute inset-x-3 bottom-3 [perspective:1400px] sm:inset-x-auto sm:bottom-auto sm:left-[6%] sm:top-1/2 sm:w-[440px] sm:-translate-y-1/2"
          >
            <div data-flip className="grid [transform-style:preserve-3d]">
              {/* Front: the fear */}
              <div className="card-dark col-start-1 row-start-1 flex flex-col items-start justify-center gap-4 p-7 [backface-visibility:hidden]">
                <ToriiGate className="h-14 w-16" color="#E0566A" beam="#FFF8FA" />
                <p className="eyebrow text-gold">{t('fears.gate', { n: i + 1 })}</p>
                <h3 className="display text-4xl text-paper sm:text-5xl">
                  {t(`fears.items.${id}.q`)}
                </h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-blush/80">
                  <span
                    aria-hidden="true"
                    className="scroll-cue inline-block h-5 w-px bg-blush/70"
                  />
                  {t('fears.passHint')}
                </p>
              </div>
              {/* Back: the answer */}
              <div className="card col-start-1 row-start-1 flex flex-col gap-3 bg-white/95 p-5 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-6">
                <div className="flex items-center gap-3">
                  <ToriiGate className="h-8 w-9 shrink-0" />
                  <div>
                    <p className="eyebrow text-rose">{t('fears.gate', { n: i + 1 })}</p>
                    <p className="font-display text-xl leading-tight text-plum">
                      {t(`fears.items.${id}.q`)}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-ink">{t(`fears.items.${id}.a`)}</p>
                {PREVIEWS[id]}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

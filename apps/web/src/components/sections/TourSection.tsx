import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ToriiGate } from '../motifs/ToriiGate';
import { StatusBadge } from '../StatusBadge';
import { LazyFoodScanPreview } from '../../features/fears/LazyFoodScanPreview';
import { PhrasePreview } from '../../features/fears/PhrasePreview';
import { VisaChecklist } from '../../features/fears/VisaChecklist';
import { RootsTeaser } from '../../features/fears/RootsTeaser';
import {
  FROM,
  LAYOUT,
  SEGMENTS,
  TOUR_CITIES,
  TOUR_VH,
  TRAIN_FEAR,
  type Segment,
} from '../../features/tour/tour';
import { useTourStore } from '../../features/tour/useTourStore';
import { cityLite as cityById } from '../../features/tour/cities';
import type { FearId } from '../../scenes/fears';
import { journey, locate } from '../../scenes/journeyState';

const PREVIEWS: Record<FearId, ReactNode> = {
  food: <LazyFoodScanPreview />,
  language: <PhrasePreview />,
  visa: <VisaChecklist />,
  foreign: <RootsTeaser />,
};

/** Split into grapheme clusters so Devanagari and Gujarati conjuncts stay intact. */
function graphemes(text: string, lang: string): string[] {
  const Seg = Intl.Segmenter;
  if (typeof Seg === 'function')
    return [...new Seg(lang, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  return [...text];
}

const fearOf = (s: Segment): FearId | null =>
  s.kind === 'spot' ? s.spot.fear : s.kind === 'train' ? TRAIN_FEAR : null;

interface Copy {
  kanji: string;
  kanjiLang: string;
  title: string;
  tagline: string;
}

/**
 * The scrolling journey. A tall section with a sticky viewport: scrolling drives
 * `journey.tour`, which flies the plane from Delhi, then moves through each city's
 * photos (plain transitions) and the Shinkansen between cities (petal portals).
 * A scrubbed timeline brings in each segment's stretched title, its fear card if
 * it has one (flipping from question to answer), and each photo's credit line.
 */
export function TourSection() {
  const { t, i18n } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const lang = i18n.language;
  const setSegment = useTourStore((s) => s.setSegment);

  const copy = useMemo<Copy[]>(
    () =>
      SEGMENTS.map((s) => {
        const city = cityById(s.cityId);
        if (s.kind === 'flight')
          return {
            kanji: `${FROM.nameLocal} → ${city?.nameJa ?? ''}`,
            kanjiLang: '',
            title: t('tour.flight.title', { from: FROM.name, to: city?.name ?? '' }),
            tagline: t('tour.flight.body'),
          };
        if (s.kind === 'train')
          return {
            kanji: '新幹線',
            kanjiLang: 'ja',
            title: t('tour.train.title', { city: city?.name ?? '' }),
            tagline: t('tour.train.body', { from: cityById(s.from)?.name ?? '' }),
          };
        return {
          kanji: s.spot.nameJa,
          kanjiLang: 'ja',
          title: s.spot.name,
          tagline: [s.spot.area, city?.name].filter(Boolean).join(', '),
        };
      }),
    [t],
  );
  // Words stay whole when a long name wraps; letters animate one by one.
  const titles = useMemo(
    () => copy.map((c) => c.title.split(' ').map((w) => graphemes(w, lang))),
    [copy, lang],
  );

  // Fonts and lazy chunks shift layout after first paint.
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    void document.fonts.ready.then(refresh);
    window.addEventListener('load', refresh);
    return () => window.removeEventListener('load', refresh);
  }, []);

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
            journey.tour = self.progress;
            // The rail and the city map window follow the scroll directly, so they keep
            // working even if the 3D canvas is paused or failed.
            setSegment(locate(self.progress * LAYOUT.total, LAYOUT.starts, LAYOUT.total).index);
          },
          onLeaveBack: () => {
            journey.tour = 0;
            setSegment(0);
          },
        },
      });

      SEGMENTS.forEach((seg, i) => {
        const at = LAYOUT.starts[i] ?? 0;
        const w = seg.weight;
        const title = el.querySelector<HTMLElement>(`[data-title="${i}"]`);
        const letters = el.querySelectorAll<HTMLElement>(`[data-title="${i}"] [data-letter]`);
        const credit = el.querySelector<HTMLElement>(`[data-credit="${i}"]`);
        if (!title) return;
        gsap.set(title, { autoAlpha: 0 });

        // Kelvin-style title: letters arrive stretched tall and relax into place
        // as the torii window finishes opening.
        const titleIn = seg.kind === 'flight' ? 0.12 : 0.05;
        tl.to(title, { autoAlpha: 1, duration: 0.04 }, at + titleIn * w);
        tl.fromTo(
          letters,
          { scaleY: 2.6, yPercent: 30, opacity: 0 },
          { scaleY: 1, yPercent: 0, opacity: 1, duration: 0.12, stagger: 0.01, ease: 'power3.out' },
          at + titleIn * w,
        );
        const fear = fearOf(seg);
        const titleOut = fear ? 0.24 : seg.kind === 'flight' ? 0.4 : 0.7;
        tl.to(
          title,
          { autoAlpha: 0, y: -40, duration: 0.06, ease: 'power2.in' },
          at + titleOut * w,
        );

        if (credit) {
          gsap.set(credit, { autoAlpha: 0 });
          tl.to(credit, { autoAlpha: 1, duration: 0.05 }, at + 0.04 * w);
          tl.to(credit, { autoAlpha: 0, duration: 0.04 }, at + 0.9 * w);
        }

        const card = el.querySelector<HTMLElement>(`[data-card="${i}"]`);
        const flip = el.querySelector<HTMLElement>(`[data-card="${i}"] [data-flip]`);
        if (!card || !flip) return;
        gsap.set(card, { autoAlpha: 0 });
        tl.fromTo(
          card,
          { autoAlpha: 0, y: 48 },
          { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power3.out' },
          at + 0.27 * w,
        );
        tl.to(flip, { rotateY: 180, duration: 0.13, ease: 'power3.inOut' }, at + 0.42 * w);
        tl.to(card, { autoAlpha: 0, y: -48, duration: 0.06, ease: 'power2.in' }, at + 0.85 * w);
      });
      tl.set({}, {}, LAYOUT.total);
    }, el);
    return () => ctx.revert();
  }, [titles, setSegment]);

  return (
    <section
      ref={root}
      id="tour"
      data-immersive
      aria-labelledby="tour-title"
      className="relative"
      style={{ height: `${TOUR_VH}vh` }}
    >
      <h2 id="tour-title" className="sr-only">
        {t('tour.title')}
      </h2>
      <ol className="sr-only">
        {TOUR_CITIES.map((c) => (
          <li key={c.id}>
            {c.name}: {c.spots.map((s) => s.name).join(', ')}
          </li>
        ))}
      </ol>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* Keeps white text readable over bright photos. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-plum/35 via-transparent to-plum/55"
        />

        {SEGMENTS.map((seg, i) => {
          const c = copy[i];
          if (!c) return null;
          return (
            <div
              key={`t${i}`}
              data-title={i}
              aria-hidden="true"
              className="invisible absolute inset-x-0 top-[16%] flex flex-col items-center px-4 text-center text-paper [text-shadow:0_4px_30px_rgb(46_20_36/0.6)]"
            >
              <p
                lang={c.kanjiLang || undefined}
                className="font-display text-2xl text-gold sm:text-3xl"
              >
                {c.kanji}
              </p>
              <p className="display flex max-w-6xl flex-wrap justify-center gap-x-[0.28em] text-[clamp(2.5rem,7.5vw,6.5rem)] leading-[1.05]">
                {(titles[i] ?? []).map((word, w) => (
                  <span key={w} className="inline-flex whitespace-nowrap">
                    {word.map((g, j) => (
                      <span key={j} data-letter className="inline-block origin-bottom">
                        {g}
                      </span>
                    ))}
                  </span>
                ))}
              </p>
              <p className="mt-4 max-w-md text-base text-blush sm:text-lg">{c.tagline}</p>
              {seg.kind === 'flight' ? (
                <p className="mt-6 flex items-center gap-2 text-sm text-blush/85">
                  <span
                    aria-hidden="true"
                    className="scroll-cue inline-block h-5 w-px bg-blush/70"
                  />
                  {t('tour.flight.hint')}
                </p>
              ) : null}
            </div>
          );
        })}

        {SEGMENTS.map((seg, i) => {
          if (seg.kind !== 'spot') return null;
          const p = seg.spot.photo;
          return (
            <p
              key={`c${i}`}
              data-credit={i}
              className="invisible absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-full bg-plum/70 px-3 py-1 text-[11px] text-blush backdrop-blur-sm sm:left-5 sm:max-w-md"
            >
              <StatusBadge status={seg.spot.status} />
              <span>
                {p.credit
                  ? t('tour.credit.by', { credit: p.credit, licence: p.licence ?? '' })
                  : t('tour.credit.pending')}
              </span>
            </p>
          );
        })}

        {SEGMENTS.map((seg, i) => {
          const fear = fearOf(seg);
          const c = copy[i];
          if (!fear || !c) return null;
          return (
            <article
              key={`f${i}`}
              data-card={i}
              aria-label={t(`fears.items.${fear}.q`)}
              className="invisible absolute inset-x-3 bottom-12 [perspective:1400px] sm:inset-x-auto sm:bottom-auto sm:left-[6%] sm:top-1/2 sm:w-[440px] sm:-translate-y-1/2"
            >
              <div data-flip className="grid [transform-style:preserve-3d]">
                <div className="card-dark col-start-1 row-start-1 flex flex-col items-start justify-center gap-4 p-7 [backface-visibility:hidden]">
                  <ToriiGate className="h-14 w-16" color="#E0566A" beam="#FFF8FA" />
                  <p className="eyebrow text-gold">
                    <span lang={c.kanjiLang || undefined}>{c.kanji}</span> · {c.title}
                  </p>
                  <h3 className="display text-4xl text-paper sm:text-5xl">
                    {t(`fears.items.${fear}.q`)}
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
                        <span lang={c.kanjiLang || undefined}>{c.kanji}</span> · {c.title}
                      </p>
                      <p className="font-display text-xl leading-tight text-plum">
                        {t(`fears.items.${fear}.q`)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-ink">{t(`fears.items.${fear}.a`)}</p>
                  {PREVIEWS[fear]}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

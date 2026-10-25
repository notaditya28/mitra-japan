import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { StatusBadge } from '../StatusBadge';
import { FlightFacts } from '../../features/tour/FlightFacts';
import { FROM, LAYOUT, SEGMENTS, TOUR_CITIES, TOUR_VH } from '../../features/tour/tour';
import { cityName, spotAbout, spotArea, spotName } from '../../features/tour/labels';
import { useTourStore } from '../../features/tour/useTourStore';
import { cityLite as cityById } from '../../features/tour/cities';
import { journey, locate } from '../../scenes/journeyState';

/** Split into grapheme clusters so Devanagari and Gujarati conjuncts stay intact. */
function graphemes(text: string, lang: string): string[] {
  const Seg = Intl.Segmenter;
  if (typeof Seg === 'function')
    return [...new Seg(lang, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  return [...text];
}

interface Copy {
  kanji: string;
  kanjiLang: string;
  title: string;
  tagline: string;
  /** Short paragraph about where you are ('' for the flight). */
  about: string;
}

/**
 * The scrolling journey. A tall section with a sticky viewport: scrolling drives
 * `journey.tour`, which flies the plane from Delhi, then moves through each city's
 * 3D scenes and the Shinkansen between cities, with a soft fade between them.
 * A scrubbed timeline brings in each segment's stretched title, a short paragraph
 * about the place, and each scene's status line.
 */
export function TourSection() {
  const { t, i18n } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const lang = i18n.language;
  const setSegment = useTourStore((s) => s.setSegment);

  const copy = useMemo<Copy[]>(
    () =>
      SEGMENTS.map((s) => {
        const city = cityName(t, s.cityId, cityById(s.cityId)?.name ?? '');
        if (s.kind === 'flight')
          return {
            kanji: `${FROM.nameLocal} → ${cityById(s.cityId)?.nameJa ?? ''}`,
            kanjiLang: '',
            title: t('tour.flight.title', { from: FROM.name, to: city }),
            tagline: t('tour.flight.body'),
            about: '',
          };
        if (s.kind === 'train')
          return {
            kanji: '新幹線',
            kanjiLang: 'ja',
            title: t('tour.train.title', { city }),
            tagline: t('tour.train.body', {
              from: cityName(t, s.from, cityById(s.from)?.name ?? ''),
            }),
            about: t('tour.train.about'),
          };
        return {
          kanji: s.spot.nameJa,
          kanjiLang: 'ja',
          title: spotName(t, s.spot),
          tagline: [spotArea(t, s.spot), city].filter(Boolean).join(', '),
          about: spotAbout(t, s.spot),
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
        // as the scene fades in.
        const titleIn = seg.kind === 'flight' ? 0.12 : 0.05;
        tl.to(title, { autoAlpha: 1, duration: 0.04 }, at + titleIn * w);
        tl.fromTo(
          letters,
          { scaleY: 2.6, yPercent: 30, opacity: 0 },
          { scaleY: 1, yPercent: 0, opacity: 1, duration: 0.12, stagger: 0.01, ease: 'power3.out' },
          at + titleIn * w,
        );
        const about = el.querySelector<HTMLElement>(`[data-about="${i}"]`);
        const titleOut = about ? 0.3 : seg.kind === 'flight' ? 0.4 : 0.7;
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

        // Non-stop routes and fares come in once the flight title has gone.
        const flightInfo = seg.kind === 'flight' ? el.querySelector<HTMLElement>('[data-flightinfo]') : null;
        if (flightInfo) {
          gsap.set(flightInfo, { autoAlpha: 0 });
          tl.fromTo(
            flightInfo,
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' },
            at + 0.42 * w,
          );
          tl.to(flightInfo, { autoAlpha: 0, y: -24, duration: 0.08, ease: 'power2.in' }, at + 0.9 * w);
        }

        if (!about) return;
        gsap.set(about, { autoAlpha: 0 });
        tl.fromTo(
          about,
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.1, ease: 'power2.out' },
          at + 0.34 * w,
        );
        tl.to(about, { autoAlpha: 0, y: -24, duration: 0.08, ease: 'power2.in' }, at + 0.8 * w);
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
        {/* Keeps white text readable over bright scenes. */}
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
          return (
            <p
              key={`c${i}`}
              data-credit={i}
              className="invisible absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-full bg-plum/70 px-3 py-1 text-[11px] text-blush backdrop-blur-sm sm:left-5 sm:max-w-md"
            >
              <StatusBadge status={seg.spot.status} />
              <span>{t('tour.scene.note')}</span>
            </p>
          );
        })}

        {SEGMENTS.map((_, i) => {
          const c = copy[i];
          if (!c?.about) return null;
          return (
            <div
              key={`a${i}`}
              data-about={i}
              className="invisible absolute inset-x-4 bottom-14 text-paper [text-shadow:0_1px_3px_rgb(26_12_24/0.95),0_2px_22px_rgb(26_12_24/0.9)] sm:inset-x-auto sm:bottom-auto sm:left-[6%] sm:top-1/2 sm:w-[420px] sm:-translate-y-1/2"
            >
              <p className="eyebrow text-gold">{t('tour.about')}</p>
              <h3 className="display mt-2 text-2xl sm:text-3xl">{c.title}</h3>
              <p className="mt-3 border-l-2 border-gold/70 pl-4 text-sm leading-relaxed text-paper/95 sm:text-base">
                {c.about}
              </p>
            </div>
          );
        })}

        {/* Left side, away from the chapter rail on the right (owner request, 2026-10-25). The
            wrapper positions; only the inner card is animated, so GSAP never bakes the centring
            transform into its own. */}
        <div className="pointer-events-none absolute inset-x-3 bottom-4 sm:inset-x-auto sm:bottom-auto sm:left-[5%] sm:top-1/2 sm:w-[400px] sm:-translate-y-1/2">
          <div
            data-flightinfo
            className="pointer-events-auto invisible rounded-2xl border border-white/15 bg-plum/75 p-4 text-paper shadow-lift backdrop-blur-md"
          >
            <FlightFacts />
          </div>
        </div>
      </div>
    </section>
  );
}

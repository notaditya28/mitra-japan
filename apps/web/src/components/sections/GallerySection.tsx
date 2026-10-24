import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { StatusBadge } from '../StatusBadge';
import { GALLERY, galleryRows, type GalleryItem } from './galleryData';

gsap.registerPlugin(ScrollTrigger);

// Sized so both rows with captions and the footnote fit one screen down to ~600px tall.
const ROW_HEIGHT = ['clamp(140px, 32svh, 380px)', 'clamp(110px, 23svh, 270px)'] as const;

function GalleryVideo({ item, autoplay, label }: { item: GalleryItem; autoplay: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !autoplay) return;
    // Clips play only while they're on screen, and never with sound.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.3 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [autoplay]);
  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster={item.poster}
      controls={!autoplay}
      aria-label={label}
      className="h-full w-full object-cover"
    >
      <source src={item.src} type="video/mp4" />
    </video>
  );
}

function Card({ item, height, autoplay }: { item: GalleryItem; height: string; autoplay: boolean }) {
  const { t } = useTranslation();
  const ratio = Math.min(1.8, Math.max(1.25, item.width / item.height));
  const alt = `${item.name}, ${item.place}`;
  return (
    <figure data-card className="shrink-0 snap-start" style={{ width: `calc(${height} * ${ratio})` }}>
      <div className="relative overflow-hidden rounded-2xl bg-white/5 shadow-lift" style={{ height }}>
        {item.kind === 'video' ? (
          <GalleryVideo item={item} autoplay={autoplay} label={t('gallery.clipLabel', { name: alt })} />
        ) : (
          <img
            src={item.src}
            alt={alt}
            width={item.width}
            height={item.height}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-plum/75 px-2.5 py-0.5 text-[11px] font-semibold text-paper backdrop-blur-sm">
          {item.kind === 'video' ? '▶ ' : ''}
          {t(`gallery.categories.${item.category}`, { defaultValue: item.category })}
        </span>
      </div>
      <figcaption className="mt-2 px-0.5">
        <p className="font-display text-base leading-tight text-paper sm:text-lg">{item.name}</p>
        <p className="text-xs text-blush/80">{item.place}</p>
        <p className="mt-0.5 truncate text-[10px] text-blush/60">
          {t(item.kind === 'video' ? 'gallery.video' : 'gallery.photo')}:{' '}
          <a href={item.credit.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-paper">
            {item.credit.author}
          </a>{' '}
          ·{' '}
          {item.credit.licenceUrl ? (
            <a href={item.credit.licenceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-paper">
              {item.credit.licence}
            </a>
          ) : (
            item.credit.licence
          )}
        </p>
      </figcaption>
    </figure>
  );
}

/** Owner request (2026-10-25): no visible heading or intro, the pictures speak; screen readers still get a name. */
function Header() {
  const { t } = useTranslation();
  return (
    <h2 id="gallery-title" className="sr-only">
      {t('gallery.eyebrow')}
    </h2>
  );
}

function Footnote() {
  const { t } = useTranslation();
  return (
    <p className="mx-auto flex w-full max-w-7xl items-center gap-2 px-4 text-[11px] text-blush/70 sm:px-8">
      <StatusBadge status="needs-review" />
      {t('gallery.footnote', { source: GALLERY.source, date: GALLERY.lastChecked })}
    </p>
  );
}

/**
 * Japan in pictures (owner request, 2026-10-25): famous sites, museums, festivals and food,
 * just before the numbers. Scroll-driven: the frame stays put while two rows slide right to
 * left at slightly different speeds, and cards turn away near the edges like a revolving
 * strip. Without motion it is a plain sideways-scrolling strip. Media: Wikimedia Commons,
 * credited on every card (`scripts/gallery_media.py`, `data/gallery.json`).
 */
export default function GallerySection({ scrubbed }: { scrubbed: boolean }) {
  const { t } = useTranslation();
  const rows = useMemo(() => galleryRows(GALLERY.items), []);
  const section = useRef<HTMLElement>(null);
  const rowRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const;
  const [distance, setDistance] = useState<[number, number]>([0, 0]);

  // How far each row has to travel for its last card to reach the right edge.
  useLayoutEffect(() => {
    if (!scrubbed) return;
    const measure = () => {
      const vw = window.innerWidth;
      const d = rowRefs.map((r) => Math.max(0, (r.current?.scrollWidth ?? 0) - vw + 32)) as [number, number];
      setDistance((prev) => (prev[0] === d[0] && prev[1] === d[1] ? prev : d));
    };
    measure();
    const ro = new ResizeObserver(measure);
    rowRefs.forEach((r) => r.current && ro.observe(r.current));
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [scrubbed]);

  useLayoutEffect(() => {
    const root = section.current;
    if (!scrubbed || !root || distance[0] === 0) return;
    const ctx = gsap.context(() => {
      const cards = rowRefs.map((r) => gsap.utils.toArray<HTMLElement>('[data-card]', r.current));
      const setters = cards.map((list) =>
        list.map((c) => ({ ry: gsap.quickSetter(c, 'rotationY', 'deg'), z: gsap.quickSetter(c, 'z', 'px') })),
      );
      // Revolving feel: a card turns away and sinks back the further it is from the centre.
      const turn = (row: 0 | 1) => () => {
        const el = rowRefs[row].current;
        if (!el) return;
        const half = window.innerWidth / 2;
        const x = Number(gsap.getProperty(el, 'x')) + el.offsetLeft;
        const list = cards[row] ?? [];
        const centres = list.map((c) => x + c.offsetLeft + c.offsetWidth / 2);
        centres.forEach((cx, i) => {
          const k = Math.max(-1.5, Math.min(1.5, (cx - half) / half));
          setters[row]?.[i]?.ry(-k * 24);
          setters[row]?.[i]?.z(-Math.abs(k) * 110);
        });
      };
      ([0, 1] as const).forEach((row) => {
        const update = turn(row);
        update();
        gsap.to(rowRefs[row].current, {
          x: -distance[row],
          ease: 'none',
          onUpdate: update,
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: row === 0 ? 0.6 : 1 },
        });
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [scrubbed, distance]);

  if (!scrubbed) {
    return (
      <section id="gallery" aria-labelledby="gallery-title" className="bg-plum py-20 sm:py-28">
        <Header />
        <div className="mt-8 space-y-6">
          {rows.map((row, r) => (
            <div
              key={r}
              role="region"
              tabIndex={0}
              aria-label={t('gallery.regionLabel')}
              className="flex snap-x gap-4 overflow-x-auto px-4 pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold sm:px-8"
            >
              {row.map((it) => (
                <Card key={it.id} item={it} height={ROW_HEIGHT[r === 0 ? 0 : 1]} autoplay={false} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Footnote />
        </div>
      </section>
    );
  }

  return (
    <section
      id="gallery"
      ref={section}
      aria-labelledby="gallery-title"
      className="relative bg-plum"
      // The section is as tall as the sideways travel, so scrolling down moves the rows 1:1.
      style={{ height: `calc(100svh + ${Math.round(Math.max(...distance))}px)` }}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center gap-4 overflow-hidden pb-3 pt-[calc(var(--nav-h,61px)+0.25rem)]">
        <Header />
        <div className="flex flex-col gap-4 [perspective:1400px]">
          {rows.map((row, r) => (
            <div
              key={r}
              ref={rowRefs[r === 0 ? 0 : 1]}
              className="flex w-max gap-5 pl-4 will-change-transform [transform-style:preserve-3d] sm:pl-8"
            >
              {row.map((it) => (
                <Card key={it.id} item={it} height={ROW_HEIGHT[r === 0 ? 0 : 1]} autoplay />
              ))}
            </div>
          ))}
        </div>
        <Footnote />
      </div>
    </section>
  );
}

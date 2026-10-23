import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import heritage from '../../data/heritage.json';
import { buildJapanMap } from '../../lib/japanMap';
import { palette } from '../../styles/tokens';
import { MOTIFS } from './motifs';
import { TileMotif } from './TileMotif';

const GRID = 5;
/** Mosaic cells (row-major in the 5×5 diamond) that hold the five deities. */
const DEITY_CELLS = [7, 11, 12, 13, 17];
const TILE_BG = [
  palette.plum,
  palette.blush,
  palette.rose,
  palette.petal,
  '#F6DDB0',
  palette.paper,
];
const TILE_FG = [
  palette.gold,
  palette.rose,
  palette.paper,
  palette.plum,
  palette.torii,
  palette.rose,
];

interface Layout {
  w: number;
  h: number;
  desktop: boolean;
  tile: number;
  card: { w: number; h: number };
  mosaic: [number, number][];
  map: ReturnType<typeof buildJapanMap>;
  pins: [number, number][];
  labels: [number, number][];
}

function computeLayout(w: number, h: number): Layout {
  const desktop = w >= 900;
  const tile = desktop ? Math.min(h * 0.12, 104) : Math.min(w * 0.15, 60);
  const card = desktop ? { w: 176, h: 58 } : { w: 128, h: 46 };
  const center: [number, number] = desktop ? [w * 0.68, h * 0.52] : [w / 2, h * 0.64];
  const step = tile * 0.78;
  const mosaic: [number, number][] = [];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      mosaic.push([center[0] + (j - i) * step, center[1] + (i + j - (GRID - 1)) * step]);
    }
  }
  const extent: [[number, number], [number, number]] = desktop
    ? [
        [w * 0.44, h * 0.1],
        [w * 0.97, h * 0.94],
      ]
    : [
        [12, h * 0.36],
        [w - 12, h * 0.97],
      ];
  const map = buildJapanMap(extent);
  const k = (extent[1][0] - extent[0][0]) / 750;
  const pins = heritage.deities.map((d) => map.project(d.lng, d.lat));
  const labels = heritage.deities.map((d, i): [number, number] => {
    const [px = 0, py = 0] = pins[i] ?? [];
    const [dx = 0, dy = 0] = d.label;
    const x = Math.min(w - card.w / 2 - 8, Math.max(card.w / 2 + 8, px + dx * k));
    const y = Math.min(h - card.h / 2 - 8, Math.max(card.h / 2 + 72, py + dy * k));
    return [x, y];
  });
  return { w, h, desktop, tile, card, mosaic, map, pins, labels };
}

/**
 * Mosaic-to-map reveal (after Mathilde de Chiara's tile re-flow): a diamond
 * of Japanese and Indian motif tiles scatters as you scroll, Japan draws
 * itself, and the five deity tiles fly to their temples as labelled cards.
 * Decorative: the same facts are in the accessible story grid below.
 *
 * `scrubbed` = false renders the final state with no scroll animation
 * (reduced motion / low-end devices).
 */
export function RootsReveal({ scrubbed }: { scrubbed: boolean }) {
  const { t } = useTranslation();
  const section = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => (size ? computeLayout(size.w, size.h) : null), [size]);

  useLayoutEffect(() => {
    const root = section.current;
    if (!root || !layout) return;
    const ctx = gsap.context(() => {
      const tiles = gsap.utils.toArray<HTMLElement>('[data-tile]');
      const deco = tiles.filter((el) => el.dataset.deity === undefined);
      const deities = tiles.filter((el) => el.dataset.deity !== undefined);
      const [cx, cy] = layout.mosaic[12] ?? [0, 0];

      tiles.forEach((el, i) => {
        const [x = 0, y = 0] = layout.mosaic[i] ?? [];
        gsap.set(el, {
          x: x - layout.tile / 2,
          y: y - layout.tile / 2,
          width: layout.tile,
          height: layout.tile,
          rotation: 45,
        });
        gsap.set(el.querySelector('[data-inner]'), { rotation: -45 });
      });
      gsap.set('[data-label]', { autoAlpha: 0 });
      gsap.set('[data-face]', { autoAlpha: 1 });

      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        paused: !scrubbed,
        scrollTrigger: scrubbed
          ? { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.7 }
          : undefined,
      });

      tl.from(
        tiles,
        { scale: 0.2, autoAlpha: 0, duration: 0.12, stagger: { each: 0.004, from: 'center' } },
        0,
      );
      tl.from('[data-intro]', { autoAlpha: 0, y: 30, duration: 0.1 }, 0.02);

      // Decorative tiles fly outward and away.
      deco.forEach((el, i) => {
        const [x = 0, y = 0] = layout.mosaic[Number(el.dataset.cell)] ?? [];
        tl.to(
          el,
          {
            x: x + (x - cx) * 2.4 - layout.tile / 2,
            y: y + (y - cy) * 2.4 - layout.tile / 2,
            rotation: 45 + (i % 2 ? 90 : -90),
            autoAlpha: 0,
            duration: 0.18,
          },
          0.32 + (i % 6) * 0.008,
        );
      });

      // Japan draws itself.
      tl.fromTo(
        '[data-pref]',
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.16, stagger: 0.002 },
        0.36,
      );
      tl.fromTo(
        '[data-pref]',
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 0.22 },
        0.36,
      );
      tl.fromTo('[data-inset]', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.48);

      // Deity tiles become label cards at their temples.
      deities.forEach((el) => {
        const i = Number(el.dataset.deity);
        const [lx = 0, ly = 0] = layout.labels[i] ?? [];
        tl.to(
          el,
          {
            x: lx - layout.card.w / 2,
            y: ly - layout.card.h / 2,
            width: layout.card.w,
            height: layout.card.h,
            rotation: 0,
            duration: 0.24,
            ease: 'power3.inOut',
          },
          0.46 + i * 0.015,
        );
        tl.to(
          el.querySelector('[data-inner]'),
          { rotation: 0, duration: 0.24, ease: 'power3.inOut' },
          0.46 + i * 0.015,
        );
        tl.to(el.querySelector('[data-face]'), { autoAlpha: 0, duration: 0.06 }, 0.52 + i * 0.015);
        tl.to(el.querySelector('[data-label]'), { autoAlpha: 1, duration: 0.08 }, 0.6 + i * 0.015);
      });

      tl.fromTo(
        '[data-leader]',
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 0.1, stagger: 0.01 },
        0.68,
      );
      tl.fromTo(
        '[data-pin]',
        { scale: 0, transformOrigin: 'center' },
        { scale: 1, duration: 0.08, stagger: 0.01, ease: 'back.out(2)' },
        0.68,
      );
      tl.fromTo(
        '[data-outro]',
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.1 },
        0.76,
      );
      tl.set({}, {}, 1);

      if (!scrubbed) tl.progress(1);
    }, root);
    return () => ctx.revert();
  }, [layout, scrubbed]);

  return (
    <section
      ref={section}
      aria-labelledby="roots-title"
      className="relative bg-paper"
      style={{ height: scrubbed ? '360vh' : undefined }}
    >
      <div
        ref={stageRef}
        className={`${scrubbed ? 'sticky top-0 h-[100svh]' : 'relative h-[100svh] min-h-[640px]'} overflow-hidden`}
      >
        <div
          data-intro
          className="absolute inset-x-4 top-24 z-10 max-w-md sm:inset-x-auto sm:left-[6%] sm:top-[26%]"
        >
          <p className="eyebrow mb-4 text-rose">{t('roots.eyebrow')}</p>
          <h2 id="roots-title" className="display text-4xl text-plum sm:text-6xl">
            {t('roots.title')}
          </h2>
          <p className="mt-5 hidden text-lg text-mist sm:block">{t('roots.body')}</p>
          <p data-outro className="mt-6 hidden text-base font-medium text-plum sm:block">
            {t('roots.mapCaption')}
          </p>
        </div>

        {layout ? (
          <>
            <svg
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${layout.w} ${layout.h}`}
            >
              <g>
                {layout.map.paths.map((p) => (
                  <path
                    key={p.id}
                    data-pref
                    d={p.d}
                    pathLength={1}
                    strokeDasharray="1"
                    fill={palette.blush}
                    stroke={palette.rose}
                    strokeOpacity={0.55}
                    strokeWidth={0.8}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
              <rect
                data-inset
                x={layout.map.inset.x}
                y={layout.map.inset.y}
                width={layout.map.inset.w}
                height={layout.map.inset.h}
                fill="none"
                stroke={palette.mist}
                strokeOpacity={0.5}
                strokeDasharray="4 4"
                rx={6}
              />
              {layout.pins.map(([px, py], i) => {
                const [lx = 0, ly = 0] = layout.labels[i] ?? [];
                return (
                  <g key={i}>
                    <path
                      data-leader
                      d={`M${px} ${py} L${lx} ${ly}`}
                      pathLength={1}
                      strokeDasharray="1"
                      stroke={palette.gold}
                      strokeWidth={1.5}
                    />
                    <g data-pin>
                      <circle
                        cx={px}
                        cy={py}
                        r={9}
                        fill={palette.gold}
                        opacity={0.3}
                        className="animate-ping-slow"
                      />
                      <circle
                        cx={px}
                        cy={py}
                        r={4.5}
                        fill={palette.gold}
                        stroke={palette.plum}
                        strokeWidth={1.5}
                      />
                    </g>
                  </g>
                );
              })}
            </svg>

            {Array.from({ length: GRID * GRID }, (_, cell) => {
              const deity = DEITY_CELLS.indexOf(cell);
              const d = deity >= 0 ? heritage.deities[deity] : undefined;
              const bg = TILE_BG[cell % TILE_BG.length] ?? palette.blush;
              const fg = TILE_FG[cell % TILE_FG.length] ?? palette.rose;
              return (
                <div
                  key={cell}
                  data-tile
                  data-cell={cell}
                  data-deity={d ? deity : undefined}
                  aria-hidden="true"
                  className="absolute left-0 top-0 overflow-hidden rounded-2xl shadow-soft"
                  style={{ background: d ? palette.gold : bg }}
                >
                  <div data-inner className="relative grid h-full w-full place-items-center">
                    {d ? (
                      <>
                        <span
                          data-face
                          lang="ja"
                          className="absolute font-display text-3xl font-bold text-plum sm:text-4xl"
                        >
                          {d.kanji.charAt(0)}
                        </span>
                        <div
                          data-label
                          className="absolute inset-0 flex items-center gap-2 px-2.5 text-left"
                        >
                          <span
                            lang="ja"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-plum font-display text-base text-gold sm:h-9 sm:w-9"
                          >
                            {d.kanji.charAt(0)}
                          </span>
                          <span className="min-w-0 leading-tight">
                            <span className="block truncate text-sm font-bold text-plum">
                              {t(`roots.indian.${d.id}`)}
                            </span>
                            <span className="block truncate text-[11px] text-plum/75">
                              {d.japanese} · {d.place.split(',')[0]}
                            </span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <TileMotif motif={MOTIFS[cell % MOTIFS.length] ?? 'sakura'} color={fg} />
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    </section>
  );
}

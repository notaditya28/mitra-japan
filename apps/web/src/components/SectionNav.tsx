import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { View } from '../lib/router';
import { jumpTo } from '../lib/sectionScroll';

const PlannerSectionNav = lazy(() => import('../features/planner/PlannerSectionNav'));

export interface SectionItem {
  id: string;
  label: string;
  /** Short Japanese label or icon shown before the name. */
  kanji?: string;
  lang?: string;
  /** Opens a dialog rather than scrolling. */
  dialog?: boolean;
  go: () => void;
}

const chip = (on: boolean, solid: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
    on
      ? solid
        ? 'bg-plum text-paper focus-visible:outline-rose'
        : 'bg-rose text-white shadow-soft focus-visible:outline-gold'
      : solid
        ? 'bg-blush text-plum hover:bg-petal focus-visible:outline-rose'
        : // Frosted plum so the links read over photos and light sections alike.
          'bg-plum/65 text-paper shadow-soft backdrop-blur-md hover:bg-plum/80 focus-visible:outline-gold'
  }`;

/** A horizontally scrolling row of section links (swipe on phones). */
export function SectionBar({
  items,
  active,
  solid,
  label,
}: {
  items: SectionItem[];
  active: string | null;
  solid: boolean;
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="flex gap-1.5 overflow-x-auto px-1 py-1 [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((it) => {
        const on = active === it.id;
        return (
          <li key={it.id}>
            <button
              type="button"
              onClick={it.go}
              aria-current={on && !it.dialog ? 'location' : undefined}
              aria-haspopup={it.dialog ? 'dialog' : undefined}
              className={chip(on, solid)}
            >
              {it.kanji ? (
                <span
                  lang={it.lang}
                  aria-hidden={it.lang ? undefined : true}
                  className="font-display"
                >
                  {it.kanji}
                </span>
              ) : null}
              {it.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Journey chapters we watch, to light up the one on screen. */
const PAGE_IDS = ['roots', 'numbers'];

function useVisibleSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    // The section crossing the middle band of the screen counts as "here".
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

// Only the two chapters after the tour (owner request, 2026-10-25); the "Build my trip"
// button covers the CTA.
function JourneySectionNav({ solid }: { solid: boolean }) {
  const { t } = useTranslation();
  const active = useVisibleSection(PAGE_IDS);
  const items: SectionItem[] = [
    { id: 'roots', label: t('nav.roots'), go: () => jumpTo('roots') },
    { id: 'numbers', label: t('nav.numbers'), go: () => jumpTo('numbers') },
  ];
  return (
    <SectionBar items={items} active={active} solid={solid} label={t('sections.journeyLabel')} />
  );
}

/**
 * Second row of the top bar: jump straight to a part of the page instead of scrolling
 * through everything. The journey lists Indian roots and the numbers; the planner lists
 * its panels and opens its tools.
 */
export function SectionNav({ view, solid }: { view: View; solid: boolean }) {
  if (view === 'journey') return <JourneySectionNav solid={solid} />;
  if (view === 'plan')
    return (
      <Suspense fallback={<div className="h-8" />}>
        <PlannerSectionNav solid={solid} />
      </Suspense>
    );
  return null;
}

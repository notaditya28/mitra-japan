import { create } from 'zustand';
import { getLenis } from './smoothScroll';

/** Height of the fixed top bar (brand row + section bar), so jumps don't hide headings under it. */
export function navHeight(): number {
  return document.querySelector<HTMLElement>('nav[aria-label="Main"]')?.offsetHeight ?? 0;
}

/**
 * Jump to an element on the page, leaving room for the top bar. Uses Lenis when it
 * drives the page; elements inside their own scroll box (the planner panel) scroll there.
 */
export function jumpTo(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const box = el.closest<HTMLElement>('[data-scroll-box]');
  const lenis = getLenis();
  if (box) {
    // Scroll the panel itself; measuring against the box keeps this right even while the
    // mobile sheet is still sliding open.
    const top =
      el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8;
    // In the mobile sheet the sheet's own slide is the motion; scroll its content instantly.
    const smooth =
      box.tagName === 'ASIDE' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
  } else if (lenis) {
    lenis.scrollTo(el, { offset: -navHeight() - 8, duration: 1.4 });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // Move keyboard focus with the jump so screen readers and Tab follow.
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  return true;
}

/**
 * Requests from the section bar to the planner's mobile bottom sheet: open it fully to
 * show a section, or lower it to reveal the map. `seq` makes repeat requests count.
 */
export const useSheetRequest = create<{
  snap: 'peek' | 'half' | 'full' | null;
  seq: number;
  request: (snap: 'peek' | 'half' | 'full') => void;
}>()((set) => ({
  snap: null,
  seq: 0,
  request: (snap) => set((s) => ({ snap, seq: s.seq + 1 })),
}));

import { getLenis } from '../../lib/smoothScroll';
import { LAYOUT, SEGMENTS, VH_PER_UNIT } from './tour';

/** Scroll position (px) that lands inside segment i, just after its transition. */
export function segmentScrollY(i: number): number {
  const tour = document.getElementById('tour');
  if (!tour) return 0;
  const seg = SEGMENTS[i];
  const at = (LAYOUT.starts[i] ?? 0) + (seg ? seg.weight * (i === 0 ? 0.3 : 0.2) : 0);
  return tour.offsetTop + (at * VH_PER_UNIT * window.innerHeight) / 100;
}

export function goToSegment(i: number) {
  const y = segmentScrollY(i);
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(y, { duration: 2.2 });
  else window.scrollTo({ top: y, behavior: 'smooth' });
}

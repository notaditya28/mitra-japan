import { useEffect, useState } from 'react';
import { jumpTo, useSheetRequest } from '../../lib/sectionScroll';

/** True at the desktop layout (map left, trip panel right). */
export function useDesktopLayout(): boolean {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return desktop;
}

/**
 * Jump to a section of the trip panel. On phones the panel is a bottom sheet, so it
 * opens before the jump.
 */
export function usePanelJump(): (id: string, fallback?: string) => void {
  const desktop = useDesktopLayout();
  const request = useSheetRequest((s) => s.request);
  return (id, fallback) => {
    const go = () => {
      if (!jumpTo(id) && fallback) jumpTo(fallback);
    };
    if (desktop) return go();
    request('full');
    // Let the sheet finish opening first.
    window.setTimeout(go, 350);
  };
}

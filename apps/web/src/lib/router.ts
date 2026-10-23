import { useSyncExternalStore } from 'react';
import { getLenis } from './smoothScroll';

export type View = 'journey' | 'login' | 'plan';

const HASHES: Record<View, string> = { journey: '', login: '#/login', plan: '#/plan' };

function read(): View {
  const h = window.location.hash;
  if (h === HASHES.login) return 'login';
  if (h === HASHES.plan) return 'plan';
  return 'journey';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/** Tiny hash router: three views, back/forward and refresh just work. */
export function useView(): View {
  return useSyncExternalStore(subscribe, read, () => 'journey');
}

export function navigate(view: View): void {
  const target = HASHES[view];
  if (target === '') {
    history.pushState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
  // Jump, don't glide: the portal veil is covering the swap.
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}

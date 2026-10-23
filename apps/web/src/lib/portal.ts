type Listener = (onCovered: () => void) => void;
let listener: Listener | null = null;

/** Registered by <PortalTransition/>; returns an unsubscribe function. */
export function onPortal(l: Listener): () => void {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
}

/**
 * Play the portal transition: the veil closes, `onCovered` swaps the page
 * underneath, then the veil opens through a torii-shaped window. Falls back
 * to calling `onCovered` directly if the overlay is not mounted.
 */
export function playPortal(onCovered: () => void): void {
  if (listener) listener(onCovered);
  else onCovered();
}

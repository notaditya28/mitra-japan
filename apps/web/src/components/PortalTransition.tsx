import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useTranslation } from 'react-i18next';
import { palette } from '../styles/tokens';
import { useReducedMotion } from '../lib/hooks';
import { onPortal } from '../lib/portal';

// Torii in local units (y down). The hole is the opening under the tie beam.
const HOLE = 'M-0.36 -0.28 H0.36 V3 H-0.36 Z';
const FRAME_RED = [
  'M-0.43 -0.42 H-0.36 V3 H-0.43 Z',
  'M0.36 -0.42 H0.43 V3 H0.36 Z',
  'M-0.52 -0.34 H0.52 V-0.28 H-0.52 Z',
  'M-0.035 -0.4 H0.035 V-0.34 H-0.035 Z',
  'M-0.54 -0.45 Q0 -0.42 0.54 -0.45 V-0.4 Q0 -0.37 -0.54 -0.4 Z',
];
const KASAGI = 'M-0.62 -0.56 Q0 -0.48 0.62 -0.56 L0.6 -0.47 Q0 -0.42 -0.6 -0.47 Z';

/** HTML/SVG version of the Petal Portal, used between pages (journey → sign-in → planner). */
export function PortalTransition() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const gate = useRef<SVGGElement>(null);
  const maskGate = useRef<SVGGElement>(null);
  const pending = useRef<(() => void) | null>(null);

  useEffect(
    () =>
      onPortal((onCovered) => {
        pending.current = onCovered;
        setActive(true);
      }),
    [],
  );

  useEffect(() => {
    if (!active || !root.current) return;
    const el = root.current;
    const state = { s: 0 };
    const apply = () => {
      const tr = `translate(50 56) scale(${state.s})`;
      gate.current?.setAttribute('transform', tr);
      maskGate.current?.setAttribute('transform', tr);
    };
    apply();

    const tl = gsap.timeline({ onComplete: () => setActive(false) });
    tl.fromTo(
      el,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: reduced ? 0.2 : 0.55, ease: 'power2.out' },
    );
    tl.fromTo(
      '[data-portal-word]',
      { autoAlpha: 0, scale: 0.85 },
      { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' },
      '<0.15',
    );
    tl.add(() => {
      pending.current?.();
      pending.current = null;
    });
    tl.to({}, { duration: 0.35 });
    if (reduced) {
      tl.to(el, { autoAlpha: 0, duration: 0.3 });
    } else {
      tl.to('[data-portal-word]', { autoAlpha: 0, scale: 1.15, duration: 0.35, ease: 'power2.in' });
      tl.to(state, { s: 260, duration: 1.4, ease: 'power3.in', onUpdate: apply }, '<0.1');
      tl.set(el, { autoAlpha: 0 });
    }
    return () => {
      tl.kill();
    };
  }, [active, reduced]);

  if (!active) return null;
  return (
    <div ref={root} className="pointer-events-auto fixed inset-0 z-[60]" aria-hidden="true">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="portal-veil" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={palette.paper} />
            <stop offset="100%" stopColor={palette.blush} />
          </radialGradient>
          <mask
            id="portal-hole"
            maskUnits="userSpaceOnUse"
            x="-50"
            y="-50"
            width="200"
            height="200"
          >
            <rect x="-50" y="-50" width="200" height="200" fill="white" />
            <g ref={maskGate}>
              <path d={HOLE} fill="black" />
            </g>
          </mask>
        </defs>
        <rect
          x="-50"
          y="-50"
          width="200"
          height="200"
          fill="url(#portal-veil)"
          mask="url(#portal-hole)"
        />
        <g ref={gate}>
          {FRAME_RED.map((d) => (
            <path key={d} d={d} fill={palette.torii} />
          ))}
          <path d={KASAGI} fill="#2A1820" />
        </g>
      </svg>
      <div data-portal-word className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p
            lang="ja"
            className="font-display text-[clamp(6rem,22vw,14rem)] leading-none text-plum"
          >
            旅
          </p>
          <p className="eyebrow mt-4 text-rose">{t('portal.caption')}</p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { decimalsOf, formatStat } from '../lib/formatStat';
import { useReducedMotion } from '../lib/hooks';

interface CounterProps {
  value: number;
  suffix?: string;
  className?: string;
}

/**
 * Counts up from zero the first time it scrolls into view (idealworks-style).
 * Screen readers and reduced-motion users get the final figure immediately.
 */
export function Counter({ value, suffix = '', className = '' }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const decimals = decimalsOf(value);
  const final = formatStat(value, decimals, suffix);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const state = { v: 0 };
    el.textContent = formatStat(0, decimals, suffix);
    const tween = gsap.to(state, {
      v: value,
      duration: 2.2,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => {
        el.textContent = formatStat(state.v, decimals, suffix);
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      el.textContent = final;
    };
  }, [value, decimals, suffix, final, reduced]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}

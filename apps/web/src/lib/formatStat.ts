/**
 * Format a statistic the way Indian readers expect (lakh/crore grouping),
 * keeping the decimals the source gave us. Used for the animated counters.
 */
export function formatStat(value: number, decimals: number, suffix = ''): string {
  const text = value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${text}${suffix}`;
}

/** Number of decimals in the source figure, so 12.5 animates as 0.0 → 12.5, not 0 → 13. */
export function decimalsOf(value: number): number {
  const s = String(value);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

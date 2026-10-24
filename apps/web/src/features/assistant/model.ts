import type { Citation, DayDiff } from './types';

/** Counts for the summary line and the "what stays" reassurance. */
export function diffCounts(days: DayDiff[]) {
  let added = 0;
  let removed = 0;
  let kept = 0;
  for (const d of days)
    for (const s of d.stops) {
      if (s.status === 'kept') kept++;
      else if (s.status === 'removed' || s.status === 'moved-out') removed++;
      else added++;
    }
  return { added, removed, kept, changedDays: days.filter((d) => d.status !== 'unchanged').length };
}

export function statusOf(c: Pick<Citation, 'status'>): 'verified' | 'sample' | 'needs-review' {
  return c.status === 'verified' ? 'verified' : c.status === 'sample' ? 'sample' : 'needs-review';
}

/** Safe external link: only http(s) URLs from our own data are rendered as links. */
export function safeUrl(url: string | null): string | null {
  return url && /^https:\/\//.test(url) ? url : null;
}

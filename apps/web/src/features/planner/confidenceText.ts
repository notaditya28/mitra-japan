import type { ConfidenceReason } from './foodConfidence';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** One Food Confidence reason in the reader's language; risk codes become words. */
export function reasonText(r: ConfidenceReason, t: Translate): string {
  if (r.key === 'risks' && typeof r.params?.items === 'string') {
    const items = r.params.items
      .split(', ')
      .map((k) => t(`planner.risks.${k}`, { defaultValue: k }))
      .join(', ');
    return t('confidence.reasons.risks', { items });
  }
  return t(`confidence.reasons.${r.key}`, r.params);
}

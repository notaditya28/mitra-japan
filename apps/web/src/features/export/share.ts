import { cityById } from '../planner/data';
import type { Itinerary } from '../planner/itinerary';

type Translate = (key: string, options?: Record<string, string | number>) => string;

/** wa.me caps what it will prefill; keep well under it so the link never breaks. */
export const SHARE_MAX = 1500;

/**
 * Plain-text trip summary for sharing. No phone number, no bot: the
 * traveller picks the contact in WhatsApp themselves.
 */
export function shareText(name: string, it: Itinerary, t: Translate): string {
  const lines = [`${name}`, ''];
  for (const d of it.days) {
    const city = cityById(d.cityId)?.name ?? d.cityId;
    const stops = d.stops.map((s) => s.name).join(', ');
    lines.push(`${t('trip.day', { n: d.day })} · ${city}: ${stops}`);
  }
  lines.push('', t('export.shareFooter'));
  if (it.source === 'sample') lines.push(t('export.shareSample'));
  const text = lines.join('\n');
  if (text.length <= SHARE_MAX) return text;
  return `${text.slice(0, SHARE_MAX - 1).trimEnd()}…`;
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

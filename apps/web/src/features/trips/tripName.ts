import { cityById } from '../planner/data';
import type { Itinerary } from '../planner/itinerary';

type Translate = (k: string, o?: Record<string, unknown>) => string;

/** "5 days · Tokyo → Osaka"-style default name for a new saved trip. */
export function defaultTripName(it: Itinerary, t: Translate) {
  const first = cityById(it.days[0]?.cityId ?? '')?.name ?? '';
  const last = cityById(it.days.at(-1)?.cityId ?? '')?.name ?? '';
  return t('trips.defaultName', { n: it.days.length, from: first, to: last });
}

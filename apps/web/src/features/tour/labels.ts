import type { TFunction } from 'i18next';
import type { Spot } from './tour';

/**
 * Names and paragraphs in the chosen language, from `tour.spots.<slug>` and
 * `tour.cities.<id>`. Falls back to the English in tour.json / cities.json.
 */
export const cityName = (t: TFunction, id: string, fallback: string): string =>
  t(`tour.cities.${id}`, { defaultValue: fallback });

export const spotName = (t: TFunction, s: Spot): string =>
  t(`tour.spots.${s.slug}.name`, { defaultValue: s.name });

export const spotArea = (t: TFunction, s: Spot): string =>
  t(`tour.spots.${s.slug}.area`, { defaultValue: s.area });

/** A short paragraph about the place, or '' if none is written yet. */
export const spotAbout = (t: TFunction, s: Spot): string =>
  t(`tour.spots.${s.slug}.about`, { defaultValue: '' });

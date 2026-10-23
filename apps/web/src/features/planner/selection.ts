import type { Day } from './itinerary';

/**
 * Itinerary ↔ map selection sync.
 * - Selecting a day card selects that day's city (marker highlight + fly-to).
 * - Selecting a city marker selects the first day in that city, or keeps the
 *   current day if it is already in that city (so re-clicking doesn't jump).
 */
export function dayForCity(
  days: Pick<Day, 'day' | 'cityId'>[],
  cityId: string | null,
  current: number | null,
): number | null {
  if (!cityId) return null;
  const currentDay = days.find((d) => d.day === current);
  if (currentDay?.cityId === cityId) return current;
  return days.find((d) => d.cityId === cityId)?.day ?? null;
}

export function cityForDay(days: Pick<Day, 'day' | 'cityId'>[], day: number | null): string | null {
  return days.find((d) => d.day === day)?.cityId ?? null;
}

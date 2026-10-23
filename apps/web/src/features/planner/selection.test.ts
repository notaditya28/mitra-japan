import { afterEach, describe, expect, it, vi } from 'vitest';
import sample from '../../data/sampleItinerary.json';
import { useAppStore } from '../../store/useAppStore';
import { parseItinerary } from './itinerary';
import { cityForDay, dayForCity } from './selection';
import { usePlannerStore } from './usePlannerStore';

const days = [
  { day: 1, cityId: 'tokyo' },
  { day: 2, cityId: 'kyoto' },
  { day: 3, cityId: 'kyoto' },
  { day: 4, cityId: 'osaka' },
];

describe('itinerary ↔ map selection sync', () => {
  it('maps a city to its first day, keeping the current day when it is already there', () => {
    expect(dayForCity(days, 'kyoto', null)).toBe(2);
    expect(dayForCity(days, 'kyoto', 3)).toBe(3);
    expect(dayForCity(days, 'nara', 2)).toBeNull();
    expect(dayForCity(days, null, 2)).toBeNull();
  });

  it('maps a day to its city', () => {
    expect(cityForDay(days, 4)).toBe('osaka');
    expect(cityForDay(days, 9)).toBeNull();
  });

  describe('store wiring', () => {
    afterEach(() => {
      usePlannerStore.setState({ itinerary: null, selectedDay: null });
      useAppStore.setState({ selectedCityId: null });
    });

    it('selecting a day card highlights its city marker, and the reverse', () => {
      const it = parseItinerary(sample);
      usePlannerStore.setState({ itinerary: it, previews: [] });
      usePlannerStore.getState().focusDay(3);
      expect(useAppStore.getState().selectedCityId).toBe(it?.days[2]?.cityId);
      usePlannerStore.getState().focusCity('tokyo');
      expect(usePlannerStore.getState().selectedDay).toBe(1);
      expect(useAppStore.getState().selectedCityId).toBe('tokyo');
    });

    it('keeps the screen usable when the planner service is down', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
      );
      await usePlannerStore.getState().plan('5 days, parents, Jain');
      const s = usePlannerStore.getState();
      expect(s.error?.code).toBe('offline');
      expect(s.itinerary?.source).toBe('sample');
      expect(s.phase).toBe('ready');
      vi.unstubAllGlobals();
    });
  });
});

import { describe, expect, it } from 'vitest';
import sample from '../../data/sampleItinerary.json';
import { shareText } from '../export/share';
import { buildSchedule, emptyDraft, planKey } from '../schedule/schedule';
import { parseItinerary, type Itinerary } from './itinerary';
import { DEFAULT_PREFS, sanitize } from './tripPrefs';

const it0 = parseItinerary(sample) as Itinerary;
const t = (key: string, o?: Record<string, string | number>) =>
  o ? `${key}:${Object.values(o).join(',')}` : key;

describe('team guide planner inputs', () => {
  it('keeps trip options inside the ranges the API accepts', () => {
    expect(sanitize({ days: 30, travellers: 0 })).toMatchObject({ days: 12, travellers: 1 });
    expect(sanitize({ days: 1 }).days).toBe(2);
    expect(sanitize({ startCity: 'paris' as never }).startCity).toBe('tokyo');
    expect(sanitize({ pace: 'sprint' as never }).pace).toBeNull();
    expect(sanitize({})).toEqual(DEFAULT_PREFS);
  });

  it('reads slots, meals and pace from the sample plan', () => {
    const day = it0.days[0];
    expect(day?.pace).toBe('relaxed');
    expect(day?.stops.every((s) => ['morning', 'afternoon', 'evening'].includes(s.slot))).toBe(
      true,
    );
    expect(day?.meals.breakfast).toBeTruthy();
  });

  it('still opens plans saved before slots and meals existed', () => {
    const old = JSON.parse(JSON.stringify(sample)) as {
      days: { stops: Record<string, unknown>[]; meals?: unknown; pace?: unknown }[];
    };
    for (const d of old.days) {
      delete d.meals;
      delete d.pace;
      for (const s of d.stops) {
        delete s.slot;
        delete s.lat;
        delete s.lng;
        delete s.durationMinutes;
      }
    }
    const parsed = parseItinerary(old);
    expect(parsed?.days[0]?.stops[0]?.slot).toBe('afternoon');
    expect(parsed?.days[0]?.meals).toEqual({
      breakfast: '',
      lunch: '',
      dinner: '',
      dietaryNotes: '',
    });
    expect(parsed?.days[0]?.pace).toBeNull();
  });
});

describe('Schedule of Stay draft', () => {
  it('dates each day from the arrival date and lists what is still missing', () => {
    const rows = buildSchedule(it0, {
      ...emptyDraft(),
      startDate: '2026-11-03',
      entries: { 1: { hotel: 'Hotel A', address: '1-1 Chiyoda', phone: '+81 3 0000 0000' } },
    });
    expect(rows.map((r) => r.date)).toEqual([
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ]);
    expect(rows[0]?.missing).toEqual([]);
    expect(rows[1]?.missing).toEqual(['hotel', 'address', 'phone']);
    expect(rows[0]?.activities).toContain(it0.days[0]?.stops[0]?.name ?? '');
  });

  it('has no dates until an arrival date is chosen, and keys drafts per plan', () => {
    expect(buildSchedule(it0, emptyDraft()).every((r) => r.date === null)).toBe(true);
    expect(planKey(it0)).toBe(planKey(JSON.parse(JSON.stringify(it0)) as Itinerary));
  });
});

describe('WhatsApp share text', () => {
  it('adds diet tags and transit lines, and stays a plain wa.me text', () => {
    const text = shareText('Trip', it0, t, ['jain', 'none']);
    expect(text.split('\n')[1]).toBe('#diets.jain');
    expect(text).toContain('trip.modes.');
    expect(text).not.toContain('#diets.none');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import sample from '../../data/sampleItinerary.json';
import { parseItinerary, type Itinerary } from '../planner/itinerary';
import { MAX_TRIPS, cleanName, reviveTrips, useTrips } from './tripsStore';

const itinerary = parseItinerary(sample) as Itinerary;
const input = (name = 'Golden route with parents') => ({
  name,
  notes: '',
  persona: 'family' as const,
  diet: 'jain' as const,
  language: 'en' as const,
  itinerary,
});

function saved(name?: string): string {
  const r = useTrips.getState().create(input(name));
  if (!('id' in r)) throw new Error(`not saved: ${r.error}`);
  return r.id;
}

describe('saved trips', () => {
  beforeEach(() => useTrips.setState({ trips: [], storageError: false }));

  it('saves, edits, duplicates and deletes', () => {
    const id = saved();
    expect(useTrips.getState().trips[0]?.name).toBe('Golden route with parents');

    expect(
      useTrips.getState().edit(id, { name: '  Kyoto   & Nara ', notes: 'Book ryokan' }),
    ).toBeNull();
    expect(useTrips.getState().trips[0]?.name).toBe('Kyoto & Nara');
    expect(useTrips.getState().trips[0]?.notes).toBe('Book ryokan');

    const copy = useTrips.getState().duplicate(id, 'copy');
    if (!('id' in copy)) throw new Error('not duplicated');
    expect(useTrips.getState().trips).toHaveLength(2);
    expect(useTrips.getState().trips[0]?.name).toBe('Kyoto & Nara (copy)');
    expect(copy.id).not.toBe(id);

    useTrips.getState().remove(id);
    expect(useTrips.getState().trips.map((t) => t.id)).toEqual([copy.id]);
  });

  it('rejects empty or overlong names and stops at the limit', () => {
    expect(useTrips.getState().create(input('   '))).toEqual({ error: 'name' });
    expect(cleanName('x'.repeat(61))).toBeNull();
    expect(useTrips.getState().edit('nope', { name: 'x' })).toBe('missing');
    for (let i = 0; i < MAX_TRIPS; i++) saved(`Trip ${i}`);
    expect(useTrips.getState().create(input('One more'))).toEqual({ error: 'full' });
  });

  it('keeps a demo booking on the trip and drops it from copies', () => {
    const id = saved();
    useTrips.getState().setBooking(id, {
      ref: 'MJ-DEMO-ABCD',
      createdAt: '2026-10-24T00:00:00Z',
      startDate: '2027-04-01',
      adults: 2,
      children: 0,
      seniors: 2,
      rooms: 2,
      leadName: 'Asha',
      notes: '',
    });
    const copy = useTrips.getState().duplicate(id, 'copy');
    if (!('id' in copy)) throw new Error('not duplicated');
    const trips = useTrips.getState().trips;
    expect(trips.find((t) => t.id === id)?.booking?.ref).toBe('MJ-DEMO-ABCD');
    expect(trips.find((t) => t.id === copy.id)?.booking).toBeNull();
  });

  it('drops malformed trips found in storage', () => {
    const good = { id: 'a', name: 'Ok', itinerary: sample };
    const revived = reviveTrips([good, { id: 'b', name: 'Bad', itinerary: { days: [] } }, 'junk']);
    expect(revived.map((t) => t.id)).toEqual(['a']);
    expect(revived[0]?.notes).toBe('');
    expect(reviveTrips(null)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import sample from '../../data/sampleItinerary.json';
import { parseDay, parseItinerary } from './itinerary';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const firstDay = () => {
  const d = sample.days[0];
  if (!d) throw new Error('sample has no days');
  return clone(d);
};

describe('itinerary validation at the API boundary', () => {
  it('accepts the sample itinerary produced by the API', () => {
    const it = parseItinerary(sample);
    expect(it?.source).toBe('sample');
    expect(it?.days).toHaveLength(5);
  });

  it('rejects non-objects, unknown sources and empty plans', () => {
    expect(parseItinerary(null)).toBeNull();
    expect(parseItinerary('{"days":[]}')).toBeNull();
    expect(parseItinerary({ ...clone(sample), source: 'ai' })).toBeNull();
    expect(parseItinerary({ ...clone(sample), days: [] })).toBeNull();
  });

  it('drops malformed days and says so', () => {
    const bad = clone(sample) as { days: unknown[] };
    bad.days[1] = { day: 'two', cityId: 'kyoto' };
    const it = parseItinerary(bad);
    expect(it?.days).toHaveLength(4);
    expect(it?.notices.at(-1)).toMatch(/could not be validated/);
  });

  it('rejects days in cities we have no data for', () => {
    const d = firstDay();
    expect(parseDay({ ...d, cityId: 'atlantis' })).toBeNull();
  });

  it('rejects unknown stop kinds, transport modes and wrong field types', () => {
    const d = firstDay();
    expect(parseDay({ ...d, stops: [{ ...d.stops[0], kind: 'teleport' }] })).toBeNull();
    expect(parseDay({ ...d, transport: { ...d.transport, mode: 'rocket' } })).toBeNull();
    expect(parseDay({ ...d, tips: [1, 2] })).toBeNull();
    expect(parseDay({ ...d, stops: [] })).toBeNull();
  });

  it('ignores unknown flag codes instead of crashing', () => {
    const d = firstDay();
    const parsed = parseDay({ ...d, flags: [{ code: 'mystery', message: 'x' }] });
    expect(parsed?.flags).toEqual([]);
  });
});

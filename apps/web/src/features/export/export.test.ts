import { describe, expect, it } from 'vitest';
import sample from '../../data/sampleItinerary.json';
import { parseItinerary, type Itinerary } from '../planner/itinerary';
import { SHARE_MAX, shareText, whatsappUrl } from './share';
import { buildTripDocument } from './tripDocument';

const itinerary = parseItinerary(sample) as Itinerary;
const t = (key: string, o?: Record<string, string | number>) =>
  o?.n !== undefined ? `Day ${o.n}` : key;

describe('WhatsApp share', () => {
  it('builds a wa.me link with no phone number and URL-encoded text', () => {
    const text = shareText('Parents in Japan', itinerary, t);
    expect(text.split('\n')[0]).toBe('Parents in Japan');
    expect(text).toContain('Day 1 · Tokyo');
    expect(text).toContain('export.shareSample');
    const url = whatsappUrl(text);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url).not.toMatch(/\s/);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(text);
  });

  it('keeps long trips under the share limit', () => {
    const long = { ...itinerary, days: [...itinerary.days, ...itinerary.days, ...itinerary.days] };
    const many = {
      ...long,
      days: long.days.map((d) => ({ ...d, stops: [...d.stops, ...d.stops, ...d.stops] })),
    };
    expect(shareText('x', many, t).length).toBeLessThanOrEqual(SHARE_MAX);
  });
});

describe('printable trip document', () => {
  const doc = buildTripDocument('Trip', itinerary, 'vegetarian', new Date('2026-10-24T10:00:00Z'));

  it('scores every day and keeps the sample label', () => {
    expect(doc.days).toHaveLength(itinerary.days.length);
    expect(doc.source).toBe('sample');
    expect(doc.generatedAt).toBe('2026-10-24');
    for (const d of doc.days) expect(d.confidence.score).toBeLessThanOrEqual(85);
  });

  it('lists each source once, with its status and check date', () => {
    const keys = doc.sources.map((s) => `${s.kind}:${s.label}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(doc.sources.some((s) => s.kind === 'city' && s.status === 'needs-review')).toBe(true);
    expect(doc.sources.some((s) => s.kind === 'restaurant')).toBe(true);
    expect(
      doc.sources.filter((s) => s.kind === 'visa').every((s) => s.url?.includes('.go.jp')),
    ).toBe(true);
    expect(doc.sources.some((s) => s.status === 'verified')).toBe(false);
  });
});

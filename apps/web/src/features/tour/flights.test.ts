import { describe, expect, it } from 'vitest';
import flights from '../../data/flights.json';
import stats from '../../data/stats.json';
import { ROUTES, inr, shortDate } from './flights';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe('non-stop flights shown on the flight scroll', () => {
  it('are sourced and marked for review', () => {
    expect(flights.status).toBe('needs-review');
    expect(flights.lastChecked).toMatch(ISO);
    for (const r of ROUTES) {
      expect(r.airline && r.from && r.to && r.frequency, r.id).toBeTruthy();
      expect(r.sourceUrl, r.id).toMatch(/^https:\/\//);
    }
  });

  it('only show fares read on the airline site, with when and for which dates', () => {
    const fares = ROUTES.flatMap((r) => (r.fare ? [r.fare] : []));
    expect(fares.length).toBeGreaterThan(0);
    for (const f of fares) {
      expect(f.amount).toBeGreaterThan(0);
      expect(f.currency).toBe('INR');
      expect(f.trip).toBe('round trip');
      expect(f.seenOn).toMatch(ISO);
      expect(f.travelDates).toBeTruthy();
      expect(f.sourceUrl).toMatch(/^https:\/\//);
    }
    expect(JSON.stringify(flights)).not.toMatch(/guarantee|cheapest ever/i);
  });

  it('formats rupees and dates for Indian readers', () => {
    expect(inr(86688)).toBe('₹86,688');
    expect(inr(115126)).toBe('₹1,15,126');
    expect(shortDate('2026-10-25')).toBe('25 Oct 2026');
  });
});

describe('the numbers section', () => {
  it('fills a figure only with a source link and the date it was read', () => {
    for (const s of stats.stats) {
      if (s.value === null) continue;
      expect(s.sourceUrl, s.id).toMatch(/^https:\/\//);
      expect(s.checkedOn, s.id).toMatch(ISO);
      expect(s.source, s.id).not.toMatch(/TODO/);
    }
  });

  it('leaves verification to the owner', () => {
    for (const s of stats.stats) expect(s.verified, s.id).toBe(false);
  });
});

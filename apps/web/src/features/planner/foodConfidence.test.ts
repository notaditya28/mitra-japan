import { describe, expect, it } from 'vitest';
import { foodConfidence, levelFor, UNVERIFIED_CAP } from './foodConfidence';
import type { Stop } from './itinerary';

const stop = (foodSpotId: string | null = null): Stop => ({
  name: 'x',
  kind: 'food',
  foodSpotId,
  heritageId: null,
  note: '',
  inOurData: foodSpotId !== null,
  slot: 'afternoon',
  durationMinutes: null,
  lat: null,
  lng: null,
});

describe('foodConfidence', () => {
  it('is deterministic for the same day and diet', () => {
    const day = { cityId: 'kyoto', stops: [stop('kyoto-shojin')] };
    expect(foodConfidence(day, 'jain')).toEqual(foodConfidence(day, 'jain'));
  });

  it('scores a veg-friendly city higher than a hard one', () => {
    const kyoto = foodConfidence({ cityId: 'kyoto', stops: [stop()] }, 'vegetarian').score;
    const fukuoka = foodConfidence({ cityId: 'fukuoka', stops: [stop()] }, 'vegetarian').score;
    expect(kyoto).toBeGreaterThan(fukuoka);
  });

  it('treats Jain as stricter than vegetarian', () => {
    const day = { cityId: 'osaka', stops: [stop()] };
    expect(foodConfidence(day, 'jain').score).toBeLessThan(foodConfidence(day, 'vegetarian').score);
  });

  it('rewards planned places that suit the diet and penalises ones that do not', () => {
    const suits = foodConfidence({ cityId: 'kyoto', stops: [stop('kyoto-shojin')] }, 'jain');
    const clash = foodConfidence({ cityId: 'kyoto', stops: [stop('kyoto-nishiki')] }, 'jain');
    expect(suits.score).toBeGreaterThan(clash.score);
    expect(clash.reasons.some((r) => r.key === 'plannedClash')).toBe(true);
  });

  it('never exceeds the unverified cap, and says why', () => {
    const r = foodConfidence(
      { cityId: 'kyoto', stops: [stop('kyoto-shojin'), stop('kyoto-yudofu')] },
      'vegetarian',
    );
    expect(r.score).toBeLessThanOrEqual(UNVERIFIED_CAP);
    expect(r.reasons.at(-1)?.key).toMatch(/cap|unverified/);
    expect(foodConfidence({ cityId: 'tokyo', stops: [stop()] }, 'none').score).toBe(UNVERIFIED_CAP);
  });

  it('lists what to double-check', () => {
    const r = foodConfidence({ cityId: 'kyoto', stops: [stop('kyoto-yudofu')] }, 'vegan');
    expect(r.reasons.find((x) => x.key === 'risks')?.params?.items).toMatch(/dashi/);
  });

  it('maps scores to ring colours', () => {
    expect([levelFor(80), levelFor(50), levelFor(20)]).toEqual(['high', 'medium', 'low']);
  });
});

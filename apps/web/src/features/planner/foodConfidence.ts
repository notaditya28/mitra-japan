import type { Diet } from '../../store/useAppStore';
import { cityById, spotsForCity, FOOD_SPOTS, type VegLevel } from './data';
import type { Day } from './itinerary';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceReason {
  /** i18n key under `confidence.reasons`. */
  key: string;
  params?: Record<string, string | number>;
  /** Signed points this reason contributed, for transparency. */
  points: number;
}

export interface FoodConfidence {
  score: number;
  level: ConfidenceLevel;
  reasons: ConfidenceReason[];
}

const BASE: Record<VegLevel, number> = { high: 60, medium: 45, low: 30 };
/** Diets that are harder to keep in Japan start lower. */
const STRICTNESS: Partial<Record<Diet, number>> = { jain: -10, vegan: -5, halal: -5 };
/** Nothing in our data is independently verified, so the score never claims more than this. */
export const UNVERIFIED_CAP = 85;
const FLOOR = 5;

export function levelFor(score: number): ConfidenceLevel {
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Deterministic Food Confidence Score for one day (0-100, capped at 85 while
 * all place data is unverified). Claude supplies explanation text only; the
 * number always comes from here, so the same day and diet give the same score.
 */
export function foodConfidence(day: Pick<Day, 'cityId' | 'stops'>, diet: Diet): FoodConfidence {
  const city = cityById(day.cityId);
  const reasons: ConfidenceReason[] = [];
  if (!city) {
    return { score: FLOOR, level: 'low', reasons: [{ key: 'unknownCity', points: 0 }] };
  }
  if (diet === 'none') {
    return {
      score: UNVERIFIED_CAP,
      level: 'high',
      reasons: [{ key: 'noRestriction', points: UNVERIFIED_CAP }],
    };
  }

  let score = BASE[city.vegLevel];
  reasons.push({ key: `city.${city.vegLevel}`, params: { city: city.name }, points: score });

  const strict = STRICTNESS[diet] ?? 0;
  if (strict) {
    score += strict;
    reasons.push({ key: `strict.${diet}`, points: strict });
  }

  const referenced = day.stops
    .map((s) => (s.foodSpotId ? FOOD_SPOTS.find((f) => f.id === s.foodSpotId) : undefined))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));
  const suits = referenced.filter((f) => f.diets.includes(diet));
  const clashes = referenced.filter((f) => !f.diets.includes(diet));
  if (suits.length > 0) {
    const p = Math.min(20, suits.length * 10);
    score += p;
    reasons.push({ key: 'plannedSuits', params: { count: suits.length }, points: p });
  }
  if (clashes.length > 0) {
    const p = -10 * clashes.length;
    score += p;
    reasons.push({ key: 'plannedClash', params: { count: clashes.length }, points: p });
  }

  const others = spotsForCity(city.id).filter(
    (f) => f.diets.includes(diet) && !referenced.some((r) => r.id === f.id),
  );
  if (others.length > 0) {
    const p = Math.min(10, others.length * 5);
    score += p;
    reasons.push({ key: 'nearbySuits', params: { count: others.length }, points: p });
  }
  if (suits.length === 0 && others.length === 0) {
    reasons.push({ key: 'noSuitablePlaces', params: { city: city.name }, points: 0 });
  }

  const risks = [...new Set([...suits, ...others].flatMap((f) => f.risks))];
  if (risks.length > 0) {
    const p = -Math.min(16, risks.length * 4);
    score += p;
    reasons.push({ key: 'risks', params: { items: risks.join(', ') }, points: p });
  }

  const capped = Math.max(FLOOR, Math.min(UNVERIFIED_CAP, Math.round(score)));
  if (Math.round(score) > UNVERIFIED_CAP) {
    reasons.push({
      key: 'cap',
      params: { cap: UNVERIFIED_CAP },
      points: UNVERIFIED_CAP - Math.round(score),
    });
  } else {
    reasons.push({ key: 'unverified', points: 0 });
  }
  return { score: capped, level: levelFor(capped), reasons };
}

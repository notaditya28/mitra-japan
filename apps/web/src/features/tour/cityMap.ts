import staysJson from '../../data/stays.json';
import type { Diet } from '../../store/useAppStore';
import { RESTAURANTS, type DietOption, type Restaurant } from '../planner/data';

export type StayKind = 'capsule' | 'business-hotel' | 'ryokan' | 'apartment';

/** A placeholder place to stay (owner decision: dummy hotels until real data exists). */
export interface Stay {
  id: string;
  cityId: string;
  name: string;
  kind: StayKind;
  area: string;
  lat: number;
  lng: number;
  note: string;
  status: 'sample';
}

export const STAYS = staysJson.stays as Stay[];

export interface FoodPin {
  restaurant: Restaurant;
  /** The option matching the traveller's diet; null when they have no restriction. */
  option: DietOption | null;
}

const STATUS_ORDER = { verified: 0, 'needs-review': 1, sample: 2 } as const;

/**
 * Food markers for the city map: places in the city that list the chosen diet.
 * "No restriction" shows everything. Real places come before illustrative samples.
 */
export function foodFor(cityId: string, diet: Diet, list: Restaurant[] = RESTAURANTS): FoodPin[] {
  return list
    .filter((r) => r.cityId === cityId)
    .flatMap<FoodPin>((r) => {
      if (diet === 'none') return [{ restaurant: r, option: null }];
      const option = r.dietOptions.find((o) => o.diet === diet);
      return option ? [{ restaurant: r, option }] : [];
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.restaurant.status] - STATUS_ORDER[b.restaurant.status] ||
        a.restaurant.name.localeCompare(b.restaurant.name),
    );
}

export const staysFor = (cityId: string, list: Stay[] = STAYS): Stay[] =>
  list.filter((s) => s.cityId === cityId);

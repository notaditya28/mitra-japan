import type { Diet } from '../../store/useAppStore';
import { CITIES, cityById, type DietBasis, type Restaurant } from '../planner/data';

export type Show = 'all' | 'listed' | 'sample';

export interface DirectoryFilters {
  query: string;
  cityId: string | 'all';
  diet: Diet | 'any';
  show: Show;
  /** Only places whose diet option has recorded evidence (not "unconfirmed"). */
  evidenceOnly: boolean;
}

export const DEFAULT_FILTERS: DirectoryFilters = {
  query: '',
  cityId: 'all',
  diet: 'any',
  show: 'all',
  evidenceOnly: false,
};

const CITY_ORDER = new Map(CITIES.map((c, i) => [c.id, i]));
const STATUS_ORDER = { verified: 0, 'needs-review': 1, sample: 2 } as const;

const fold = (s: string) => s.normalize('NFKC').toLowerCase();

function haystack(r: Restaurant): string {
  const city = cityById(r.cityId);
  return fold(
    [r.name, r.nameJa, r.cuisine, r.area, r.address, r.kind, city?.name, city?.nameJa]
      .filter(Boolean)
      .join(' '),
  );
}

export const hasEvidence = (basis: DietBasis) => basis !== 'unconfirmed';

/** Search + filters. Real places come before illustrative samples within a city. */
export function filterRestaurants(list: Restaurant[], f: DirectoryFilters): Restaurant[] {
  const terms = fold(f.query).split(/\s+/).filter(Boolean);
  return list
    .filter((r) => f.cityId === 'all' || r.cityId === f.cityId)
    .filter((r) =>
      f.show === 'all' ? true : f.show === 'sample' ? r.status === 'sample' : r.status !== 'sample',
    )
    .filter((r) => {
      const options =
        f.diet === 'any' || f.diet === 'none'
          ? r.dietOptions
          : r.dietOptions.filter((o) => o.diet === f.diet);
      if (options.length === 0) return false;
      return !f.evidenceOnly || options.some((o) => hasEvidence(o.basis));
    })
    .filter((r) => {
      if (terms.length === 0) return true;
      const text = haystack(r);
      return terms.every((t) => text.includes(t));
    })
    .sort(
      (a, b) =>
        (CITY_ORDER.get(a.cityId) ?? 99) - (CITY_ORDER.get(b.cityId) ?? 99) ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.name.localeCompare(b.name),
    );
}

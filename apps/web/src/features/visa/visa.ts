import visaJson from '../../data/visa.json';
import type { VisaPurpose, VisaTraveller } from '../../store/useAppStore';

export interface VisaLink {
  id: string;
  label: string;
  url: string;
}

/**
 * Where a line comes from: `team-guide` = MITRA_JAPAN_SYSTEM_GUIDE.md, shown as written with a
 * "From our team guide" label (owner decision); `official-summary` = researched from official pages.
 */
export type VisaSource = 'team-guide' | 'official-summary';

export type VisaCategory = 'route' | 'identity' | 'finance' | 'schedule' | 'purpose';

export interface VisaItem {
  id: string;
  category: VisaCategory;
  text: string;
  purposes: VisaPurpose[] | 'all';
  travellers: VisaTraveller[] | 'all';
  link: string | null;
  source: VisaSource;
  /** `schedule` items offer the Schedule of Stay draft from the planner. */
  action?: 'schedule';
}

export interface VisaOffice {
  id: string;
  name: string;
  centres: string[];
  states: string[];
}

type TypeId = 'evisa' | 'single' | 'multiple';

export const VISA = visaJson as {
  status: 'needs-review' | 'verified';
  lastReviewed: string | null;
  researched: string;
  guideNote: string;
  links: VisaLink[];
  purposes: VisaPurpose[];
  travellers: VisaTraveller[];
  categories: { id: VisaCategory; label: string }[];
  items: VisaItem[];
  types: {
    source: VisaSource;
    columns: { id: TypeId; label: string }[];
    rows: ({ id: string; label: string } & Record<TypeId, string>)[];
  };
  finance: { source: VisaSource; items: { id: string; label: string; text: string }[] };
  jurisdictions: {
    source: VisaSource;
    note: string;
    offices: VisaOffice[];
    unlisted: string[];
  };
  pitfalls: { source: VisaSource; items: { id: string; title: string; text: string }[] };
};

export const linkById = (id: string | null): VisaLink | undefined =>
  VISA.links.find((l) => l.id === id);

/** The checklist for one purpose and kind of traveller. Nothing else is asked. */
export function itemsFor(purpose: VisaPurpose, traveller: VisaTraveller): VisaItem[] {
  return VISA.items.filter(
    (i) =>
      (i.purposes === 'all' || i.purposes.includes(purpose)) &&
      (i.travellers === 'all' || i.travellers.includes(traveller)),
  );
}

/** Items grouped by category, in the order the categories are listed (empty groups dropped). */
export function groupItems(items: VisaItem[]) {
  return VISA.categories
    .map((c) => ({ ...c, items: items.filter((i) => i.category === c.id) }))
    .filter((g) => g.items.length > 0);
}

/** Every state and union territory the guide names, alphabetically. */
export const STATES = [
  ...new Set([
    ...VISA.jurisdictions.offices.flatMap((o) => o.states),
    ...VISA.jurisdictions.unlisted,
  ]),
].sort((a, b) => a.localeCompare(b));

/** The Embassy or Consulate the guide lists for a state; undefined when the guide doesn't say. */
export const officeForState = (state: string): VisaOffice | undefined =>
  VISA.jurisdictions.offices.find((o) => o.states.includes(state));

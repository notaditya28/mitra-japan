import visaJson from '../../data/visa.json';
import type { VisaPurpose, VisaTraveller } from '../../store/useAppStore';

export interface VisaLink {
  id: string;
  label: string;
  url: string;
}

export interface VisaItem {
  id: string;
  text: string;
  purposes: VisaPurpose[] | 'all';
  travellers: VisaTraveller[] | 'all';
  link: string | null;
}

export const VISA = visaJson as {
  status: 'needs-review' | 'verified';
  lastReviewed: string | null;
  researched: string;
  links: VisaLink[];
  purposes: VisaPurpose[];
  travellers: VisaTraveller[];
  items: VisaItem[];
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

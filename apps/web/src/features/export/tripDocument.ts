import heritageJson from '../../data/heritage.json';
import type { Diet } from '../../store/useAppStore';
import { RESTAURANTS, cityById, type DataStatus } from '../planner/data';
import { foodConfidence, type FoodConfidence } from '../planner/foodConfidence';
import type { Day, Itinerary } from '../planner/itinerary';
import { localDay } from '../../lib/dates';
import { VISA } from '../visa/visa';

/** A source cited in the printed trip, with how far it has been checked. */
export interface SourceEntry {
  kind: 'city' | 'restaurant' | 'heritage' | 'visa';
  label: string;
  status: DataStatus;
  source: string | null;
  lastChecked: string | null;
  url: string | null;
}

export interface DocDay {
  day: Day;
  cityName: string;
  cityJa: string;
  confidence: FoodConfidence;
}

export interface TripDocument {
  name: string;
  generatedAt: string;
  diet: Diet;
  source: Itinerary['source'];
  model: string | null;
  summary: string;
  days: DocDay[];
  visaChecklist: string[];
  bestSeason: string;
  etiquetteTips: string[];
  notices: string[];
  sources: SourceEntry[];
}

const HERITAGE = heritageJson.deities as {
  id: string;
  japanese: string;
  place: string;
  references: string[];
  status: DataStatus;
  lastChecked: string | null;
}[];

/**
 * Everything the printable trip needs, worked out once: per-day Food
 * Confidence and a deduplicated list of every data source the plan relies
 * on, each with its verification status and date.
 */
export function buildTripDocument(
  name: string,
  it: Itinerary,
  diet: Diet,
  generatedAt = new Date(),
): TripDocument {
  const sources = new Map<string, SourceEntry>();
  const add = (key: string, e: SourceEntry) => {
    if (!sources.has(key)) sources.set(key, e);
  };

  const days = it.days.map((d) => {
    const city = cityById(d.cityId);
    if (city)
      add(`city:${city.id}`, {
        kind: 'city',
        label: city.name,
        status: city.status,
        source: null,
        lastChecked: city.lastChecked,
        url: null,
      });
    for (const s of d.stops) {
      const r = s.foodSpotId ? RESTAURANTS.find((x) => x.id === s.foodSpotId) : undefined;
      if (r)
        add(`restaurant:${r.id}`, {
          kind: 'restaurant',
          label: r.name,
          status: r.status,
          source: r.source,
          lastChecked: r.lastChecked,
          url: r.link,
        });
      const h = s.heritageId ? HERITAGE.find((x) => x.id === s.heritageId) : undefined;
      if (h)
        add(`heritage:${h.id}`, {
          kind: 'heritage',
          label: `${h.japanese} · ${h.place}`,
          status: h.status,
          source: null,
          lastChecked: h.lastChecked,
          url: h.references[0] ?? null,
        });
    }
    return {
      day: d,
      cityName: city?.name ?? d.cityId,
      cityJa: city?.nameJa ?? '',
      confidence: foodConfidence(d, diet),
    };
  });

  if (it.visaChecklist.length > 0)
    for (const l of VISA.links)
      add(`visa:${l.id}`, {
        kind: 'visa',
        label: l.label,
        status: VISA.status,
        source: null,
        lastChecked: VISA.lastReviewed,
        url: l.url,
      });

  return {
    name,
    generatedAt: localDay(generatedAt),
    diet,
    source: it.source,
    model: it.model,
    summary: it.summary,
    days,
    visaChecklist: it.visaChecklist,
    bestSeason: it.bestSeason,
    etiquetteTips: it.etiquetteTips,
    notices: it.notices,
    sources: [...sources.values()],
  };
}

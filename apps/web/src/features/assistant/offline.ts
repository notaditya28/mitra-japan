import emergencyJson from '../../data/emergency.json';
import { CITIES, FOOD_SPOTS, distanceKm, type FoodSpot } from '../planner/data';
import type { Diet } from '../../store/useAppStore';
import type { EmergencyContact, EmergencyPayload } from './types';

/**
 * Browser-side emergency card from the bundled emergency.json, so the emergency path works
 * with no API and no network. Same content and rules as the server's rag/emergency.py.
 */
interface Mission {
  name: string;
  emergency: string;
  emergency_note: string;
  consular: string;
  consular_note: string;
  region: string[];
  source_url: string;
}
interface Situation {
  title: string;
  urgent_action: string;
  urgent_action_hi: string;
  steps: string[];
  steps_hi: string[];
  contacts: string[];
  sources: string[];
}
interface EmergencyData {
  status: string;
  last_verified: string | null;
  disclaimer: string;
  disclaimer_hi: string;
  numbers: { id: string; label: string; value: string; note: string; source_url: string }[];
  missions: Mission[];
  situations: Record<string, Situation>;
  replan_prompt: string;
  replan_prompt_hi: string;
}

export const EMERGENCY = emergencyJson as unknown as EmergencyData;
export const EMERGENCY_KINDS = Object.keys(EMERGENCY.situations);

export function missionsFor(cityIds: string[]): Mission[] {
  const matched = EMERGENCY.missions.filter((m) => m.region.some((r) => cityIds.includes(r)));
  return matched.length > 0 ? matched : EMERGENCY.missions;
}

export function offlineEmergency(
  kind: string,
  cityIds: string[],
  language: string,
): EmergencyPayload {
  const s = EMERGENCY.situations[kind] ?? EMERGENCY.situations.police;
  if (!s) throw new Error('emergency.json has no situations');
  const hi = language === 'hi';
  const contacts: EmergencyContact[] = [];
  for (const ref of s.contacts) {
    if (ref === 'mission') {
      for (const m of missionsFor(cityIds)) {
        contacts.push({
          label: `${m.name} (emergency)`,
          value: m.emergency,
          kind: 'phone',
          note: m.emergency_note,
          source_url: m.source_url,
        });
        contacts.push({
          label: `${m.name} (consular)`,
          value: m.consular,
          kind: 'phone',
          note: m.consular_note,
          source_url: m.source_url,
        });
      }
      continue;
    }
    const n = EMERGENCY.numbers.find((x) => x.id === ref);
    if (n)
      contacts.push({
        label: n.label,
        value: n.value,
        kind: 'phone',
        note: n.note,
        source_url: n.source_url,
      });
  }
  return {
    kind: EMERGENCY.situations[kind] ? kind : 'police',
    title: s.title,
    urgent_action: hi ? s.urgent_action_hi : s.urgent_action,
    steps: hi ? s.steps_hi : s.steps,
    contacts,
    replan_prompt: hi ? EMERGENCY.replan_prompt_hi : EMERGENCY.replan_prompt,
    disclaimer: hi ? EMERGENCY.disclaimer_hi : EMERGENCY.disclaimer,
    status: EMERGENCY.status,
    last_verified: EMERGENCY.last_verified,
    sources: s.sources,
    offline: true,
  };
}

/** tel: link for a displayed number ("050-3816-2787", "+81-80330-15242 / ..." → first number). */
export function telHref(value: string): string | null {
  const first = value.split('/')[0]?.trim() ?? '';
  const digits = first.replace(/[^\d+]/g, '');
  return digits.length >= 3 ? `tel:${digits}` : null;
}

export interface NearbyPlace {
  spot: FoodSpot;
  km: number;
  suits: boolean;
}

/**
 * Rank our own food places by distance from the traveller (coordinates never leave the
 * browser), then by whether they're listed as suiting the diet. Only places in our data.
 */
export function nearbyFood(
  lat: number,
  lng: number,
  diet: Diet,
  limit = 5,
  maxKm = 30,
): NearbyPlace[] {
  return FOOD_SPOTS.map((spot) => ({
    spot,
    km: distanceKm({ lat, lng }, spot),
    suits: diet === 'none' || spot.diets.includes(diet),
  }))
    .filter((p) => p.km <= maxKm)
    .sort((a, b) => Number(b.suits) - Number(a.suits) || a.km - b.km)
    .slice(0, limit);
}

export function nearestCity(lat: number, lng: number): string | null {
  let best: { id: string; km: number } | null = null;
  for (const c of CITIES) {
    const km = distanceKm({ lat, lng }, c);
    if (!best || km < best.km) best = { id: c.id, km };
  }
  return best && best.km < 80 ? best.id : null;
}

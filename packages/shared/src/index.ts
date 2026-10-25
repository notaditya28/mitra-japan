/**
 * Shared vocabulary for the traveller app, the partner site and the API (addendum 5 v3).
 * The JSON files are the source; the API reads the same files in Python.
 */
import dietsJson from '../diets.json';

export const DIET_IDS = ['jain', 'vegetarian', 'vegan', 'halal', 'no_beef', 'eggless'] as const;
export type DietId = (typeof DIET_IDS)[number];

export const STATUS_IDS = ['fully_verified', 'partially_verified', 'not_verified', 'not_suitable'] as const;
export type StatusId = (typeof STATUS_IDS)[number];

export const METHODS = ['phone', 'visit', 'third_party_certificate', 'corroborated_traveler_reports'] as const;
export type VerificationMethod = (typeof METHODS)[number];

export type DataOrigin = 'real' | 'sample';

export interface DietMeta {
  id: DietId;
  label: string;
  labelJa: string;
}

export interface StatusMeta {
  id: StatusId;
  label: string;
  demoLabel?: string;
  meaning: string;
}

export const DIETS = dietsJson.diets as DietMeta[];
export const STATUSES = dietsJson.statuses as StatusMeta[];
export const PAUSED_LABEL = dietsJson.pausedLabel;

/** The traveller app spells it `no-beef`; the API and shared rules use `no_beef`. */
export function toApiDiet(webDiet: string): DietId | null {
  const id = webDiet === 'no-beef' ? 'no_beef' : webDiet;
  return (DIET_IDS as readonly string[]).includes(id) ? (id as DietId) : null;
}

export interface DietStatusView {
  diet: DietId;
  status: StatusId;
  /** Text to show next to the icon: never colour alone. */
  label: string;
  demo: boolean;
  paused: boolean;
  method: VerificationMethod | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  verifiedDishIds: string[];
  missingItems: string[];
  reasons: string[];
  dataOrigin: DataOrigin;
}

/** The label a traveller sees for one status record. */
export function statusLabel(s: Pick<DietStatusView, 'status' | 'demo' | 'paused'>): string {
  if (s.paused) return PAUSED_LABEL;
  const meta = STATUSES.find((m) => m.id === s.status);
  if (!meta) return s.status;
  return s.status === 'fully_verified' && s.demo ? (meta.demoLabel ?? meta.label) : meta.label;
}

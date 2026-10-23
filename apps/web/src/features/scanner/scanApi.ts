import { API, readError, type PlannerError } from '../planner/plannerApi';
import type { Diet, Language } from '../../store/useAppStore';
import type { CustomRestriction, ScanResult } from './matchIngredients';

export interface ScanExplanation {
  explanation: string;
  askStaffJa: string;
  askStaffEn: string;
}

export interface ScanExplainBody {
  menuText: string;
  diet: Diet;
  language: Language;
  verdict: ScanResult['verdict'];
  matches: { term: string; en: string; rule: 'avoid' | 'ask' | null }[];
  unknown: string[];
  custom: CustomRestriction[];
}

export function explainBody(
  text: string,
  result: ScanResult,
  diet: Diet,
  language: Language,
  custom: CustomRestriction[],
): ScanExplainBody {
  return {
    menuText: text.slice(0, 2000),
    diet,
    language,
    verdict: result.verdict,
    matches: result.matches
      .slice(0, 40)
      .map((m) => ({ term: m.term, en: m.ingredient.en.slice(0, 80), rule: m.rule })),
    unknown: result.unknown.slice(0, 30).map((w) => w.slice(0, 40)),
    custom: custom.slice(0, 10),
  };
}

function isExplanation(v: unknown): v is ScanExplanation {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.explanation === 'string' &&
    typeof o.askStaffJa === 'string' &&
    typeof o.askStaffEn === 'string'
  );
}

/** Ask the AI guide to put a scan result into words. The verdict never changes. */
export async function explainWithAi(
  body: ScanExplainBody,
  signal?: AbortSignal,
): Promise<{ explanation: ScanExplanation } | { error: PlannerError }> {
  let res: Response;
  try {
    res = await fetch(`${API}/api/scan-explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return { error: { code: 'offline', message: 'The guide service is not reachable.' } };
  }
  if (!res.ok) return { error: await readError(res) };
  const data: unknown = await res.json();
  return isExplanation(data)
    ? { explanation: data }
    : { error: { code: 'invalid_response', message: 'The explanation could not be read.' } };
}

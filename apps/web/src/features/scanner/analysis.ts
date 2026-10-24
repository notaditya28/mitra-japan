import type { Diet } from '../../store/useAppStore';
import type { ScanResult, Verdict } from './matchIngredients';

/**
 * The extra parts of a scan result from the team guide's OCRAnalysisResult:
 * uncertainty notes (why we can't be sure) and practical advice (what to do next).
 * Deterministic and built only from what was matched; returned as i18n keys + values.
 */
export interface Note {
  key: string;
  values?: Record<string, string>;
}

export function uncertaintyNotes(
  result: ScanResult,
  verdict: Verdict,
  lowConfidence: boolean,
): Note[] {
  const notes: Note[] = [];
  if (result.reason === 'unreadable') notes.push({ key: 'scanner.notes.unreadable' });
  if (lowConfidence) notes.push({ key: 'scanner.notes.lowConfidence' });
  for (const m of result.matches)
    if (m.rule === 'ask' && m.ingredient.ambiguity)
      notes.push({
        key: 'scanner.notes.ambiguous',
        values: { term: m.term, why: m.ingredient.ambiguity },
      });
  if (result.unknown.length > 0)
    notes.push({
      key: 'scanner.notes.unknown',
      values: { words: result.unknown.slice(0, 6).join('、') },
    });
  // Always true for a label or a menu: we only see what is written.
  if (verdict !== 'conflict') notes.push({ key: 'scanner.notes.unlisted' });
  return notes;
}

export function practicalAdvice(result: ScanResult, verdict: Verdict, diet: Diet): Note[] {
  const ids = new Set(result.matches.map((m) => m.ingredient.id));
  const advice: Note[] = [];
  if (verdict === 'conflict') advice.push({ key: 'scanner.advice.conflict' });
  if (verdict === 'unverified') advice.push({ key: 'scanner.advice.ask' });
  if (ids.has('dashi') || ids.has('bonito') || ids.has('niboshi') || ids.has('tsuyu'))
    advice.push({ key: 'scanner.advice.dashi' });
  if (diet === 'jain' && (ids.has('onion') || ids.has('garlic') || ids.has('root-veg')))
    advice.push({ key: 'scanner.advice.jain' });
  if (diet === 'halal' && (ids.has('alcohol') || ids.has('soy-sauce') || ids.has('miso')))
    advice.push({ key: 'scanner.advice.halal' });
  if (ids.has('seasoning-generic') || ids.has('emulsifier') || ids.has('colouring'))
    advice.push({ key: 'scanner.advice.additives' });
  if (ids.has('tempura')) advice.push({ key: 'scanner.advice.frying' });
  advice.push({ key: 'scanner.advice.staffCard' });
  return advice;
}

import dictionary from '../../data/ingredients.json';
import type { Diet } from '../../store/useAppStore';

export type Rule = 'avoid' | 'ask';
export type Verdict = 'safe' | 'ask' | 'avoid';

export interface Ingredient {
  id: string;
  terms: string[];
  en: string;
  category: string;
  rules: Partial<Record<Diet, Rule>>;
  note: string;
}

export interface Match {
  ingredient: Ingredient;
  term: string;
  index: number;
  rule: Rule | null;
}

export interface ScanResult {
  matches: Match[];
  verdict: Verdict;
}

const INGREDIENTS: Ingredient[] = dictionary.ingredients as Ingredient[];

// Longest terms first so 昆布だし beats だし and 牛乳 beats 牛.
const TERMS = INGREDIENTS.flatMap((ingredient) =>
  ingredient.terms.map((term) => ({ term, ingredient })),
).sort((a, b) => b.term.length - a.term.length);

/**
 * Find dictionary ingredients in Japanese text and judge them for a diet.
 * Each character can belong to only one match, so overlapping shorter terms
 * inside an already-matched longer term are ignored.
 */
export function matchIngredients(text: string, diet: Diet): ScanResult {
  const taken = new Array<boolean>(text.length).fill(false);
  const matches: Match[] = [];

  for (const { term, ingredient } of TERMS) {
    let from = 0;
    for (;;) {
      const index = text.indexOf(term, from);
      if (index === -1) break;
      from = index + term.length;
      const span = taken.slice(index, index + term.length);
      if (span.some(Boolean)) continue;
      taken.fill(true, index, index + term.length);
      matches.push({ ingredient, term, index, rule: ingredient.rules[diet] ?? null });
    }
  }

  matches.sort((a, b) => a.index - b.index);
  return { matches: dedupe(matches), verdict: verdictFor(matches) };
}

function dedupe(matches: Match[]): Match[] {
  const seen = new Set<string>();
  return matches.filter((m) =>
    seen.has(m.ingredient.id) ? false : (seen.add(m.ingredient.id), true),
  );
}

export function verdictFor(matches: Pick<Match, 'rule'>[]): Verdict {
  if (matches.some((m) => m.rule === 'avoid')) return 'avoid';
  if (matches.some((m) => m.rule === 'ask')) return 'ask';
  return 'safe';
}

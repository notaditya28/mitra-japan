import dictionary from '../../data/ingredients.json';
import type { Diet } from '../../store/useAppStore';

export type Rule = 'avoid' | 'ask';

/**
 * The only three scanner outcomes (owner rule): we never say "safe".
 * - clear: no listed conflicts detected (in the text we could read)
 * - conflict: a listed ingredient conflicts with the diet
 * - unverified: unreadable text, or an ambiguous broth/sauce/stock
 */
export type Verdict = 'clear' | 'conflict' | 'unverified';

export interface Ingredient {
  id: string;
  terms: string[];
  reading: string;
  en: string;
  category: string;
  rules: Partial<Record<Diet, Rule>>;
  note: string;
  ambiguity: string;
}

export interface Match {
  ingredient: Ingredient;
  term: string;
  index: number;
  rule: Rule | null;
}

/** A user-defined restriction, e.g. { term: 'きのこ', label: 'Mushrooms' }. */
export interface CustomRestriction {
  term: string;
  label: string;
}

export interface ScanResult {
  matches: Match[];
  verdict: Verdict;
  /** Why the verdict is "unverified" when nothing ambiguous was matched. */
  reason?: 'unreadable';
}

const INGREDIENTS: Ingredient[] = dictionary.ingredients as Ingredient[];

// Longest terms first so 昆布だし beats だし and 牛乳 beats 牛.
const TERMS = INGREDIENTS.flatMap((ingredient) =>
  ingredient.terms.map((term) => ({ term, ingredient })),
).sort((a, b) => b.term.length - a.term.length);

/** Any kana or kanji at all: without them there is nothing we can check. */
const JAPANESE = /[぀-ヿ㐀-鿿]/;

function customIngredient(c: CustomRestriction): Ingredient {
  return {
    id: `custom:${c.term}`,
    terms: [c.term],
    reading: '',
    en: c.label,
    category: 'custom',
    rules: {},
    note: 'Your own restriction.',
    ambiguity: '',
  };
}

/**
 * Find dictionary ingredients in Japanese text and judge them for a diet.
 * Each character can belong to only one match, so overlapping shorter terms
 * inside an already-matched longer term are ignored. Custom restrictions are
 * always treated as conflicts.
 */
export function matchIngredients(
  text: string,
  diet: Diet,
  custom: CustomRestriction[] = [],
): ScanResult {
  if (!JAPANESE.test(text)) return { matches: [], verdict: 'unverified', reason: 'unreadable' };

  const taken = new Array<boolean>(text.length).fill(false);
  const matches: Match[] = [];
  const customTerms = custom
    .filter((c) => c.term.trim().length > 0)
    .map((c) => ({ term: c.term.trim(), ingredient: customIngredient(c), custom: true }));
  const all = [...customTerms, ...TERMS.map((t) => ({ ...t, custom: false }))].sort(
    (a, b) => b.term.length - a.term.length,
  );

  for (const { term, ingredient, custom: isCustom } of all) {
    let from = 0;
    for (;;) {
      const index = text.indexOf(term, from);
      if (index === -1) break;
      from = index + term.length;
      if (taken.slice(index, index + term.length).some(Boolean)) continue;
      taken.fill(true, index, index + term.length);
      const rule: Rule | null = isCustom ? 'avoid' : (ingredient.rules[diet] ?? null);
      matches.push({ ingredient, term, index, rule });
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
  if (matches.some((m) => m.rule === 'avoid')) return 'conflict';
  if (matches.some((m) => m.rule === 'ask')) return 'unverified';
  return 'clear';
}

import dictionary from '../../data/ingredients.json';
import type { Diet } from '../../store/useAppStore';

export type Rule = 'avoid' | 'ask';

/**
 * The only three scanner outcomes (owner rule): we never say "safe".
 * - clear: no listed conflicts detected (in the text we could read)
 * - conflict: a listed ingredient conflicts with the diet
 * - unverified: unreadable text, an ambiguous broth/sauce/stock, or words
 *   we don't recognise (unknown never counts as clear)
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
  /** Words in the ingredient text that are not in our dictionary. */
  unknown: string[];
  /** Why the verdict is "unverified" when nothing ambiguous was matched. */
  reason?: 'unreadable' | 'unknown';
}

const INGREDIENTS: Ingredient[] = dictionary.ingredients as Ingredient[];
const MENU_WORDS = [...dictionary.menuWords.terms].sort((a, b) => b.length - a.length);

// Longest terms first so 昆布だし beats だし and 牛乳 beats 牛.
const TERMS = INGREDIENTS.flatMap((ingredient) =>
  ingredient.terms.map((term) => ({ term, ingredient })),
).sort((a, b) => b.term.length - a.term.length);

/** Any kana or kanji at all: without them there is nothing we can check. */
const JAPANESE = /[぀-ヿ㐀-鿿]/;
const JAPANESE_CHAR = /^[぀-ヿ㐀-鿿]$/u;
/** Separators between ingredients on a menu or label. */
const SEPARATOR = /[、，,・／/\s()（）「」『』【】［］[\]。.:：;；]/;

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
  if (!JAPANESE.test(text))
    return { matches: [], verdict: 'unverified', unknown: [], reason: 'unreadable' };

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
  const unknown = unknownWords(text, taken);
  const verdict = verdictFor(matches);
  if (verdict === 'clear' && unknown.length > 0)
    return { matches: dedupe(matches), verdict: 'unverified', unknown, reason: 'unknown' };
  return { matches: dedupe(matches), verdict, unknown };
}

/**
 * Words we could not account for. A dish title before a colon
 * ("野菜カレー：…") is skipped: the list after it is what we judge, though
 * ingredients named in the title still count. Known menu words (定食, 円 …)
 * are ignored. Whatever Japanese text is left is unknown.
 */
function unknownWords(text: string, taken: boolean[]): string[] {
  const covered = [...taken];
  const skip = new Array<boolean>(text.length).fill(false);
  let lineStart = 0;
  for (const line of text.split('\n')) {
    const colon = line.search(/[：:]/);
    if (colon > 0) skip.fill(true, lineStart, lineStart + colon);
    lineStart += line.length + 1;
  }
  for (const word of MENU_WORDS) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(word, from);
      if (i === -1) break;
      from = i + word.length;
      if (!covered.slice(i, i + word.length).some(Boolean)) covered.fill(true, i, i + word.length);
    }
  }
  const words: string[] = [];
  let current = '';
  const flush = () => {
    if (current) words.push(current);
    current = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (SEPARATOR.test(ch) || covered[i] || skip[i] || !JAPANESE_CHAR.test(ch)) flush();
    else current += ch;
  }
  flush();
  return [...new Set(words)];
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

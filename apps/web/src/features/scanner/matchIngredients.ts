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

/** Which of the dictionary's five scripts matched (team guide: kanji, kana, romaji, English). */
export type MatchedBy = 'kanji' | 'kana' | 'romaji' | 'english' | 'custom';

/** critical = conflicts with the diet, warning = can't tell, info = listed, no conflict. */
export type Severity = 'critical' | 'warning' | 'info';

export interface Ingredient {
  id: string;
  /** Kanji and kana spellings and aliases. */
  terms: string[];
  /** Romaji spellings, matched as whole words in Latin-script text. */
  romaji: string[];
  /** English names, matched as whole words in Latin-script text. */
  english: string[];
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
  matchedBy: MatchedBy;
  severity: Severity;
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
const LATIN_STOP = new Set(dictionary.latinWords.terms);

const KANJI = /[㐀-鿿]/;
const byScript = (term: string): MatchedBy => (KANJI.test(term) ? 'kanji' : 'kana');

// Longest terms first so 昆布だし beats だし and 牛乳 beats 牛.
const TERMS = INGREDIENTS.flatMap((ingredient) =>
  ingredient.terms.map((term) => ({ term, ingredient, by: byScript(term) })),
).sort((a, b) => b.term.length - a.term.length);

const LATIN_TERMS = INGREDIENTS.flatMap((ingredient) => [
  ...ingredient.romaji.map((term) => ({ term, ingredient, by: 'romaji' as const })),
  ...ingredient.english.map((term) => ({ term, ingredient, by: 'english' as const })),
]).sort((a, b) => b.term.length - a.term.length);

/** Any kana or kanji at all. */
const JAPANESE = /[぀-ヿ㐀-鿿]/;
const JAPANESE_CHAR = /^[぀-ヿ㐀-鿿]$/u;
const LATIN = /[a-z]/i;
const LATIN_CHAR = /^[a-z]$/;
/** Separators between ingredients on a menu or label. */
const SEPARATOR = /[、，,・／/\s()（）「」『』【】［］[\]。.:：;；]/;

export const severityFor = (rule: Rule | null): Severity =>
  rule === 'avoid' ? 'critical' : rule === 'ask' ? 'warning' : 'info';

function customIngredient(c: CustomRestriction): Ingredient {
  return {
    id: `custom:${c.term}`,
    terms: [c.term],
    romaji: [],
    english: [],
    reading: '',
    en: c.label,
    category: 'custom',
    rules: {},
    note: 'Your own restriction.',
    ambiguity: '',
  };
}

/**
 * Lower-case and strip accents one character at a time, so indexes still line up
 * with the original text (ō → o, Ā → a).
 */
function foldLatin(text: string): string {
  let out = '';
  for (const ch of text) {
    const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    // Keep one output unit per input unit so positions match.
    out += (base.charAt(0) || ch).padEnd(ch.length, ' ');
  }
  return out;
}

const isWordChar = (s: string, i: number) => LATIN_CHAR.test(s.charAt(i));

/**
 * Find dictionary ingredients in Japanese, romaji or English text and judge them for a
 * diet. Each character can belong to only one match, so overlapping shorter terms inside
 * an already-matched longer term are ignored. Custom restrictions are always conflicts.
 */
export function matchIngredients(
  text: string,
  diet: Diet,
  custom: CustomRestriction[] = [],
): ScanResult {
  const hasJapanese = JAPANESE.test(text);
  if (!hasJapanese && !LATIN.test(text))
    return { matches: [], verdict: 'unverified', unknown: [], reason: 'unreadable' };

  const taken = new Array<boolean>(text.length).fill(false);
  const matches: Match[] = [];
  const customTerms = custom
    .filter((c) => c.term.trim().length > 0)
    .map((c) => ({ term: c.term.trim(), ingredient: customIngredient(c), by: 'custom' as const }));
  const all = [...customTerms, ...TERMS].sort((a, b) => b.term.length - a.term.length);

  const record = (ingredient: Ingredient, term: string, index: number, by: MatchedBy) => {
    const rule: Rule | null = by === 'custom' ? 'avoid' : (ingredient.rules[diet] ?? null);
    matches.push({ ingredient, term, index, rule, matchedBy: by, severity: severityFor(rule) });
  };

  for (const { term, ingredient, by } of all) {
    let from = 0;
    for (;;) {
      const index = text.indexOf(term, from);
      if (index === -1) break;
      from = index + term.length;
      if (taken.slice(index, index + term.length).some(Boolean)) continue;
      taken.fill(true, index, index + term.length);
      record(ingredient, term, index, by);
    }
  }

  // Latin-script text (romaji or English, as on bilingual packaging): whole words only.
  const folded = foldLatin(text);
  for (const { term, ingredient, by } of LATIN_TERMS) {
    let from = 0;
    for (;;) {
      const index = folded.indexOf(term, from);
      if (index === -1) break;
      from = index + term.length;
      const end = index + term.length;
      if (isWordChar(folded, index - 1) || isWordChar(folded, end)) continue;
      if (taken.slice(index, end).some(Boolean)) continue;
      taken.fill(true, index, end);
      record(ingredient, text.slice(index, end), index, by);
    }
  }

  matches.sort((a, b) => a.index - b.index);
  const unknown = [...unknownWords(text, taken), ...unknownLatin(folded, taken)];
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

/** Latin words that are neither ingredients nor label words ("ingredients", "contains" …). */
function unknownLatin(folded: string, taken: boolean[]): string[] {
  const words: string[] = [];
  let current = '';
  let touched = false;
  const flush = () => {
    if (current.length > 1 && !touched && !LATIN_STOP.has(current)) words.push(current);
    current = '';
    touched = false;
  };
  for (let i = 0; i < folded.length; i++) {
    if (isWordChar(folded, i)) {
      current += folded.charAt(i);
      if (taken[i]) touched = true;
    } else flush();
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

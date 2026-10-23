import type { CustomRestriction, ScanResult } from './matchIngredients';

/** Japanese terms worth asking about: conflicts first, then the ones we couldn't judge. */
export function termsToAsk(result: ScanResult | null): string[] {
  if (!result) return [];
  const avoid = result.matches.filter((m) => m.rule === 'avoid').map((m) => m.term);
  const ask = result.matches.filter((m) => m.rule === 'ask').map((m) => m.term);
  return [...new Set([...avoid, ...ask])].slice(0, 5);
}

/** "Does this dish contain 「A」 or 「B」?" in plain, polite Japanese. */
export function containsQuestionJa(terms: string[]): string | null {
  if (terms.length === 0) return null;
  return `この料理に${terms.map((t) => `「${t}」`).join('や')}は入っていますか？`;
}

/** "I can't eat 「A」 or 「B」." for the traveller's own restrictions. */
export function customLineJa(custom: CustomRestriction[]): string | null {
  if (custom.length === 0) return null;
  return `${custom.map((c) => `「${c.term}」`).join('や')}は食べられません。`;
}

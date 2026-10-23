import type { ScanResult } from './matchIngredients';

type Translate = (key: string, options?: Record<string, string>) => string;

const MAX_UNKNOWN = 4;

/**
 * Plain sentences explaining a scan result, always naming the cause:
 * which ingredients conflict, which ones we could not judge, and which
 * words we did not recognise at all.
 */
export function explainScan(result: ScanResult, t: Translate): string {
  if (result.reason === 'unreadable') return t('scanner.explain.unreadable');
  const names = (rule: 'avoid' | 'ask') =>
    result.matches
      .filter((m) => m.rule === rule)
      .map((m) => m.ingredient.en)
      .join(', ');
  const unknown =
    result.unknown.length > 0
      ? t('scanner.explain.unknown', {
          items: result.unknown
            .slice(0, MAX_UNKNOWN)
            .map((w) => `「${w}」`)
            .join(' '),
        })
      : '';
  const join = (...parts: string[]) => parts.filter(Boolean).join(' ');

  switch (result.verdict) {
    case 'conflict':
      return join(t('scanner.explain.conflict', { items: names('avoid') }), unknown);
    case 'unverified': {
      const ask = names('ask');
      return ask ? join(t('scanner.explain.unverified', { items: ask }), unknown) : unknown;
    }
    case 'clear':
      return t('scanner.explain.clear');
  }
}

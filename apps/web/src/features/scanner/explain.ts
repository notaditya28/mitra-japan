import type { ScanResult } from './matchIngredients';

type Translate = (key: string, options?: Record<string, string>) => string;

/**
 * One plain sentence explaining a scan result, always naming the cause:
 * which ingredients conflict, or which ones we could not judge.
 */
export function explainScan(result: ScanResult, t: Translate): string {
  if (result.reason === 'unreadable') return t('scanner.explain.unreadable');
  const names = (rule: 'avoid' | 'ask') =>
    result.matches
      .filter((m) => m.rule === rule)
      .map((m) => m.ingredient.en)
      .join(', ');
  switch (result.verdict) {
    case 'conflict':
      return t('scanner.explain.conflict', { items: names('avoid') });
    case 'unverified':
      return t('scanner.explain.unverified', { items: names('ask') });
    case 'clear':
      return t('scanner.explain.clear');
  }
}

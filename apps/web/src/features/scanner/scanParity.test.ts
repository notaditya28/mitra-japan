import { describe, expect, it } from 'vitest';
import saved from '../../data/__fixtures__/scanVerdicts.json';
import samples from '../../data/sampleScans.json';
import type { Diet } from '../../store/useAppStore';
import { matchIngredients } from './matchIngredients';

/**
 * The API's matcher (apps/api/app/ingredients.py) must agree with this one. Both are
 * checked against the same fixture; regenerate it after changing the dictionary with
 *   UPDATE_PARITY=1 pnpm --filter web exec vitest run src/features/scanner/scanParity.test.ts
 */
const FIXTURE = new URL('../../data/__fixtures__/scanVerdicts.json', import.meta.url);
const UPDATE = Boolean((import.meta.env as Record<string, unknown>).UPDATE_PARITY);
const DIETS: Diet[] = ['jain', 'vegetarian', 'vegan', 'halal', 'no-beef', 'eggless', 'none'];
const EXTRA = [
  'Ingredients: rice, soy sauce, bonito extract',
  'katsuobushi, wakame',
  'Ingredients: graham crackers',
  '原材料：牛脂、動物油脂、調味料（アミノ酸等）',
  'ラムネ、カキ氷、貝割れ大根',
  '???? 12',
];

function snapshot() {
  const texts = [
    ...samples.scans.map((s) => ({ id: s.id, text: s.menuText })),
    ...EXTRA.map((text, i) => ({ id: `extra-${i}`, text })),
  ];
  return texts.map(({ id, text }) => ({
    id,
    text,
    results: Object.fromEntries(
      DIETS.map((diet) => {
        const r = matchIngredients(text, diet);
        return [
          diet,
          {
            verdict: r.verdict,
            ids: r.matches.map((m) => m.ingredient.id),
            matchedBy: r.matches.map((m) => m.matchedBy),
            unknown: r.unknown,
          },
        ];
      }),
    ),
  }));
}

describe('scanner parity fixture', () => {
  it('matches the fixture shared with the API', async () => {
    const now = snapshot();
    if (UPDATE) {
      // Node's fs, loaded only when regenerating (the app's types don't include Node).
      const fs = (await import(/* @vite-ignore */ `node:${'fs'}`)) as {
        writeFileSync: (file: URL, data: string, encoding: string) => void;
      };
      fs.writeFileSync(FIXTURE, `${JSON.stringify({ cases: now }, null, 2)}\n`, 'utf8');
      return;
    }
    expect(now).toEqual(saved.cases);
  });
});

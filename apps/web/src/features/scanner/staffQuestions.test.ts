import { describe, expect, it } from 'vitest';
import { matchIngredients } from './matchIngredients';
import { containsQuestionJa, customLineJa, termsToAsk } from './staffQuestions';

describe('staff card', () => {
  it('asks about conflicts first, then ambiguous items', () => {
    const r = matchIngredients('味噌汁：出汁、ラード、豆腐', 'vegetarian');
    expect(termsToAsk(r)).toEqual(['ラード', '出汁']);
    expect(containsQuestionJa(termsToAsk(r))).toBe(
      'この料理に「ラード」や「出汁」は入っていますか？',
    );
  });

  it('has nothing to ask for a clear result and lists custom restrictions', () => {
    expect(containsQuestionJa(termsToAsk(matchIngredients('枝豆', 'vegan')))).toBeNull();
    expect(customLineJa([{ term: 'きのこ', label: 'Mushrooms' }])).toBe(
      '「きのこ」は食べられません。',
    );
  });
});

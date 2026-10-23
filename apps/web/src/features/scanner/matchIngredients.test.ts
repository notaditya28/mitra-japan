import { describe, expect, it } from 'vitest';
import { matchIngredients } from './matchIngredients';

const ids = (text: string, diet: Parameters<typeof matchIngredients>[1]) =>
  matchIngredients(text, diet).matches.map((m) => m.ingredient.id);

describe('matchIngredients', () => {
  it('flags hidden bonito stock in a "vegetable" ramen for vegetarians', () => {
    const r = matchIngredients('野菜ラーメン（かつお出汁、味噌）', 'vegetarian');
    expect(r.verdict).toBe('avoid');
    expect(r.matches.map((m) => m.ingredient.id)).toEqual(['bonito']);
  });

  it('reads kombu stock as plant-based, not fish dashi', () => {
    expect(ids('昆布だしの湯豆腐', 'vegetarian')).toEqual(['kombu-dashi']);
    expect(matchIngredients('昆布だしの湯豆腐', 'vegetarian').verdict).toBe('safe');
  });

  it('does not read milk (牛乳) as beef (牛)', () => {
    expect(ids('牛乳プリン', 'no-beef')).toEqual(['milk']);
    expect(matchIngredients('牛乳プリン', 'no-beef').verdict).toBe('safe');
    expect(matchIngredients('牛丼', 'no-beef').verdict).toBe('avoid');
  });

  it('judges the same dish differently per diet', () => {
    const text = '醤油ラーメン：鶏ガラ、みりん、ねぎ';
    expect(matchIngredients(text, 'vegetarian').verdict).toBe('avoid');
    expect(matchIngredients(text, 'halal').verdict).toBe('avoid'); // mirin
    expect(matchIngredients(text, 'no-beef').verdict).toBe('safe');
  });

  it('applies Jain rules to onion, garlic and root vegetables', () => {
    const r = matchIngredients('野菜カレー：じゃがいも、にんじん、玉ねぎ', 'jain');
    expect(r.verdict).toBe('avoid');
    expect(r.matches.map((m) => m.ingredient.id)).toEqual(['root-veg', 'onion']);
  });

  it('returns "ask" when only uncertain ingredients are present', () => {
    expect(matchIngredients('オムライス（卵）', 'vegetarian').verdict).toBe('ask');
  });

  it('is safe when nothing matches', () => {
    expect(matchIngredients('枝豆', 'vegan')).toEqual({ matches: [], verdict: 'safe' });
  });
});

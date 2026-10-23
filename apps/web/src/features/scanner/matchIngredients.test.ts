import { describe, expect, it } from 'vitest';
import { matchIngredients } from './matchIngredients';

const ids = (text: string, diet: Parameters<typeof matchIngredients>[1]) =>
  matchIngredients(text, diet).matches.map((m) => m.ingredient.id);

describe('matchIngredients', () => {
  it('flags hidden bonito stock in a "vegetable" ramen as a conflict for vegetarians', () => {
    const r = matchIngredients('野菜ラーメン（かつお出汁、味噌）', 'vegetarian');
    expect(r.verdict).toBe('conflict');
    expect(r.matches.filter((m) => m.rule === 'avoid').map((m) => m.ingredient.id)).toEqual([
      'bonito',
    ]);
  });

  it('reads kombu stock as plant-based, not fish dashi', () => {
    expect(ids('昆布だしの湯豆腐', 'vegetarian')).toEqual(['kombu-dashi', 'tofu']);
    expect(matchIngredients('昆布だしの湯豆腐', 'vegetarian').verdict).toBe('clear');
  });

  it('treats a plain "dashi" as unable to verify, never as clear', () => {
    const r = matchIngredients('味噌汁：出汁、豆腐', 'vegetarian');
    expect(r.verdict).toBe('unverified');
    const dashi = r.matches.find((m) => m.ingredient.id === 'dashi');
    expect(dashi?.rule).toBe('ask');
    expect(dashi?.ingredient.ambiguity).toMatch(/kombu/);
  });

  it('treats unspecified sauces and broths as unable to verify', () => {
    expect(matchIngredients('焼きそば（たれ）', 'vegan').verdict).toBe('unverified');
    expect(matchIngredients('ざるそば・めんつゆ', 'jain').verdict).toBe('unverified');
  });

  it('returns unable to verify for unreadable or non-Japanese text', () => {
    expect(matchIngredients('', 'vegan')).toEqual({
      matches: [],
      verdict: 'unverified',
      unknown: [],
      reason: 'unreadable',
    });
    expect(matchIngredients('???? 12', 'jain').verdict).toBe('unverified');
  });

  it('does not read milk (牛乳) as beef (牛)', () => {
    expect(ids('牛乳寒天', 'no-beef')).toEqual(['milk', 'agar']);
    expect(matchIngredients('牛乳寒天', 'no-beef').verdict).toBe('clear');
    expect(matchIngredients('牛丼', 'no-beef').verdict).toBe('conflict');
  });

  it('keeps diet categories distinct', () => {
    const text = '野菜炒め：玉ねぎ、にんにく、じゃがいも';
    // Vegetarian is not Jain: onion, garlic and potato are fine for vegetarians …
    expect(matchIngredients(text, 'vegetarian').verdict).toBe('clear');
    // … but conflict for Jain.
    const jain = matchIngredients(text, 'jain');
    expect(jain.verdict).toBe('conflict');
    expect(jain.matches.filter((m) => m.rule === 'avoid').map((m) => m.ingredient.id)).toEqual([
      'onion',
      'garlic',
      'root-veg',
    ]);
    // Halal covers alcohol including mirin; no-beef does not.
    expect(matchIngredients('なす焼き：なす、みりん、醤油', 'halal').verdict).toBe('conflict');
    expect(matchIngredients('なす焼き：なす、みりん、醤油', 'no-beef').verdict).toBe('clear');
    // Vegan is separate again: dairy conflicts for vegans only.
    expect(matchIngredients('チーズ豆腐', 'vegan').verdict).toBe('conflict');
    expect(matchIngredients('チーズ豆腐', 'vegetarian').verdict).toBe('clear');
  });

  it('treats ambiguous egg as unable to verify for vegetarians', () => {
    expect(matchIngredients('オムライス（卵）', 'vegetarian').verdict).toBe('unverified');
  });

  it('applies custom restrictions as conflicts', () => {
    const r = matchIngredients('きのこご飯', 'vegetarian', [
      { term: 'きのこ', label: 'Mushrooms' },
    ]);
    expect(r.verdict).toBe('conflict');
    expect(r.matches[0]?.ingredient.en).toBe('Mushrooms');
  });

  it('reports no listed conflicts when nothing matches', () => {
    const r = matchIngredients('枝豆', 'vegan');
    expect(r.verdict).toBe('clear');
    expect(r.unknown).toEqual([]);
  });

  it('never reports unknown words as clear', () => {
    const r = matchIngredients('特製まぼろし丼', 'vegetarian');
    expect(r.verdict).toBe('unverified');
    expect(r.reason).toBe('unknown');
    expect(r.unknown).toEqual(['まぼろし']);
  });

  it('judges the ingredient list after a dish title, and ignores menu words', () => {
    const r = matchIngredients('季節の野菜カレー定食：なす、ご飯 800円', 'vegetarian');
    // Curry roux is still ambiguous even though the title is not checked for unknowns.
    expect(r.verdict).toBe('unverified');
    expect(r.unknown).toEqual([]);
    expect(
      matchIngredients('湯豆腐定食：豆腐、昆布だし、ご飯　900円（税込）', 'vegan').verdict,
    ).toBe('clear');
  });

  it('treats soy sauce and miso as ask for halal (they can contain alcohol)', () => {
    expect(matchIngredients('冷奴：豆腐、醤油', 'halal').verdict).toBe('unverified');
    expect(matchIngredients('冷奴：豆腐、醤油', 'vegetarian').verdict).toBe('clear');
  });
});

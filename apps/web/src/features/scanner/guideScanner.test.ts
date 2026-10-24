import { describe, expect, it } from 'vitest';
import dictionary from '../../data/ingredients.json';
import samples from '../../data/sampleScans.json';
import { practicalAdvice, uncertaintyNotes } from './analysis';
import { matchIngredients } from './matchIngredients';
import { cropRect } from './ocr/image';

const presets = samples.scans.filter((s) => 'preset' in s && s.preset);
const verdict = (id: string, diet: Parameters<typeof matchIngredients>[1]) =>
  matchIngredients(presets.find((p) => p.id === id)?.menuText ?? '', diet).verdict;

describe('team guide scanner features', () => {
  it('has the four packaging presets, with the expected results for vegetarians', () => {
    expect(presets.map((p) => p.id)).toEqual([
      'pack-miso-soup',
      'pack-zaru-soba',
      'pack-rice-cracker',
      'pack-matcha-mochi',
    ]);
    expect(verdict('pack-miso-soup', 'vegetarian')).toBe('conflict');
    expect(verdict('pack-zaru-soba', 'vegetarian')).toBe('conflict');
    expect(verdict('pack-rice-cracker', 'vegetarian')).toBe('conflict');
    expect(verdict('pack-matcha-mochi', 'vegetarian')).toBe('clear');
  });

  it('keeps every dictionary entry in five scripts', () => {
    for (const e of dictionary.ingredients) {
      expect(e.terms.length, e.id).toBeGreaterThan(0);
      expect(Array.isArray(e.romaji), e.id).toBe(true);
      expect(Array.isArray(e.english), e.id).toBe(true);
      expect(e.en, e.id).toBeTruthy();
    }
    const total = dictionary.ingredients.reduce(
      (n, e) => n + e.terms.length + e.romaji.length + e.english.length,
      0,
    );
    expect(total).toBeGreaterThanOrEqual(200);
  });

  it('includes the guide hazards: beef tallow, animal fat, alliums, additives', () => {
    expect(matchIngredients('原材料：牛脂', 'no-beef').verdict).toBe('conflict');
    expect(matchIngredients('原材料：動物油脂', 'halal').verdict).toBe('conflict');
    expect(matchIngredients('原材料：浅葱', 'jain').verdict).toBe('conflict');
    const additives = matchIngredients('原材料：調味料（アミノ酸等）、乳化剤', 'vegetarian');
    expect(additives.verdict).toBe('unverified');
    expect(additives.matches.map((m) => m.ingredient.id)).toEqual([
      'seasoning-generic',
      'emulsifier',
    ]);
  });

  it('records which script matched and how severe it is', () => {
    const r = matchIngredients('かつおエキス、大豆、豆腐', 'vegetarian');
    const bonito = r.matches.find((m) => m.ingredient.id === 'bonito');
    expect(bonito?.matchedBy).toBe('kana');
    expect(bonito?.severity).toBe('critical');
    expect(r.matches.find((m) => m.ingredient.id === 'soy')?.matchedBy).toBe('kanji');
    expect(r.matches.find((m) => m.ingredient.id === 'soy')?.severity).toBe('info');
  });

  it('reads romaji and English on bilingual packaging, as whole words', () => {
    const r = matchIngredients('Ingredients: rice, soy sauce, bonito extract', 'vegetarian');
    expect(r.verdict).toBe('conflict');
    expect(r.matches.find((m) => m.ingredient.id === 'bonito')?.matchedBy).toBe('english');
    expect(matchIngredients('katsuobushi', 'vegan').matches[0]?.matchedBy).toBe('romaji');
    // "ham" must not match inside "graham"; unknown English words keep it unverified.
    const graham = matchIngredients('Ingredients: graham crackers', 'vegetarian');
    expect(graham.matches.map((m) => m.ingredient.id)).not.toContain('pork');
    expect(graham.verdict).toBe('unverified');
  });

  it('never reads look-alikes as meat or shellfish', () => {
    expect(matchIngredients('ラムネ', 'vegetarian').verdict).toBe('clear');
    expect(matchIngredients('カキ氷', 'vegetarian').verdict).toBe('clear');
    expect(matchIngredients('貝割れ大根', 'vegetarian').verdict).toBe('clear');
  });

  it('explains uncertainty and gives practical advice', () => {
    const r = matchIngredients('味噌汁：出汁、豆腐、ネギ', 'jain');
    const notes = uncertaintyNotes(r, r.verdict, false).map((n) => n.key);
    expect(notes).toContain('scanner.notes.ambiguous');
    const advice = practicalAdvice(r, r.verdict, 'jain').map((n) => n.key);
    expect(advice).toContain('scanner.advice.dashi');
    expect(advice).toContain('scanner.advice.jain');
    expect(advice.at(-1)).toBe('scanner.advice.staffCard');
  });
});

describe('crop guide', () => {
  it('turns a fractional frame into pixels, clamped to the photo', () => {
    expect(cropRect(null, 1000, 800)).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 800 });
    expect(cropRect({ x: 0.1, y: 0.25, w: 0.5, h: 0.5 }, 1000, 800)).toEqual({
      sx: 100,
      sy: 200,
      sw: 500,
      sh: 400,
    });
    expect(cropRect({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, 1000, 800)).toEqual({
      sx: 900,
      sy: 720,
      sw: 100,
      sh: 80,
    });
  });
});

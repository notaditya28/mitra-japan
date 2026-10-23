import phrases from '../../data/phrases.json';
import type { Diet } from '../../store/useAppStore';

export type Phrase = (typeof phrases.phrases)[number];

export function phraseForDiet(diet: Diet): Phrase | undefined {
  return (
    phrases.phrases.find((p) => (p.diets as string[]).includes(diet)) ??
    phrases.phrases.find((p) => p.id === 'ask-ingredients')
  );
}

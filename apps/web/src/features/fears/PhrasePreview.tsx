import { useTranslation } from 'react-i18next';
import phrases from '../../data/phrases.json';
import { useAppStore, type Diet, type Language } from '../../store/useAppStore';

type Phrase = (typeof phrases.phrases)[number];

function phraseForDiet(diet: Diet): Phrase | undefined {
  return (
    phrases.phrases.find((p) => (p.diets as string[]).includes(diet)) ??
    phrases.phrases.find((p) => p.id === 'ask-ingredients')
  );
}

const ORDER: Record<Language, Language[]> = {
  en: ['hi', 'gu', 'en'],
  hi: ['hi', 'gu', 'en'],
  gu: ['gu', 'hi', 'en'],
};

/** "Show this to staff" card. Follows the chosen diet and UI language. HI/GU pending native review. */
export function PhrasePreview() {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const language = useAppStore((s) => s.language);
  const phrase = phraseForDiet(diet);
  if (!phrase) return null;

  return (
    <div className="rounded-2xl border border-blush bg-paper p-4">
      <p className="eyebrow mb-2 text-rose">{t('phrase.show')}</p>
      <p lang="ja" className="font-display text-xl leading-snug text-plum">
        {phrase.ja}
      </p>
      <p className="mt-1 text-xs italic text-mist">
        {t('phrase.say')}: {phrase.romaji}
      </p>
      <div className="mt-3 space-y-1 border-t border-blush pt-3 text-sm">
        {ORDER[language].map((l, i) => (
          <p key={l} lang={l} className={i === 0 ? 'font-semibold text-ink' : 'text-mist'}>
            {phrase[l]}
          </p>
        ))}
      </div>
    </div>
  );
}

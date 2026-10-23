import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import gu from './locales/gu.json';
import { useAppStore, type Language } from './store/useAppStore';

// EN is complete. HI and GU cover Stage 1 and phrase cards; missing keys fall back to EN.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, gu: { translation: gu } },
  lng: useAppStore.getState().language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function apply(lang: Language) {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

apply(useAppStore.getState().language);
useAppStore.subscribe((s, prev) => {
  if (s.language !== prev.language) apply(s.language);
});

export default i18n;

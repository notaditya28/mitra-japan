import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import { useAppStore, type Language } from './store/useAppStore';

// EN ships with the page; HI and GU (drafts pending native review) load on demand.
// Missing keys fall back to EN.
const LOADERS: Record<Exclude<Language, 'en'>, () => Promise<{ default: unknown }>> = {
  hi: () => import('./locales/hi.json'),
  gu: () => import('./locales/gu.json'),
};

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

let pending: Language | null = null;

async function apply(lang: Language) {
  pending = lang;
  if (lang !== 'en' && !i18n.hasResourceBundle(lang, 'translation')) {
    try {
      const mod = await LOADERS[lang]();
      i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
    } catch {
      // Offline or chunk failed: stay readable in English.
      return;
    }
  }
  // A newer choice may have arrived while this one was loading.
  if (pending !== lang) return;
  await i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

void apply(useAppStore.getState().language);
useAppStore.subscribe((s, prev) => {
  if (s.language !== prev.language) void apply(s.language);
});

export default i18n;

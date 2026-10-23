import { useTranslation } from 'react-i18next';
import { useAppStore, type Language } from '../store/useAppStore';

const LANGS: { id: Language; label: string; name: string }[] = [
  { id: 'en', label: 'EN', name: 'English' },
  { id: 'hi', label: 'हिं', name: 'हिन्दी' },
  { id: 'gu', label: 'ગુ', name: 'ગુજરાતી' },
];

export function LanguageSwitch({ solid }: { solid: boolean }) {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  return (
    <div
      role="group"
      aria-label={t('nav.language')}
      className={`flex rounded-full border p-0.5 text-sm ${
        solid ? 'border-blush bg-white/70' : 'border-white/25 bg-white/10'
      }`}
    >
      {LANGS.map((l) => {
        const active = l.id === language;
        return (
          <button
            key={l.id}
            type="button"
            lang={l.id}
            aria-pressed={active}
            aria-label={l.name}
            onClick={() => setLanguage(l.id)}
            className={`min-w-9 rounded-full px-2.5 py-1 font-semibold transition-colors duration-300 ${
              active ? 'bg-rose text-white' : solid ? 'text-plum' : 'text-paper'
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

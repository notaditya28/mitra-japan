import { useTranslation } from 'react-i18next';
import { useTools, type Tool } from './useTools';

const ICONS: Record<Tool, string> = {
  scan: 'M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M7 12h10',
  eat: 'M7 3v8a2 2 0 002 2v8M11 3v6M5 3v6M17 3c-1.7 1.3-2.5 3.3-2.5 6v4H17v8',
  visa: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
};

/** Left-panel card that opens the scanner, the restaurant directory and the visa checklist. */
export function ToolLauncher() {
  const { t } = useTranslation();
  const open = useTools((s) => s.open);

  return (
    <section aria-labelledby="tools-title">
      <h2 id="tools-title" className="eyebrow text-rose">
        {t('tools.title')}
      </h2>
      <ul className="mt-3 grid gap-2">
        {(['scan', 'eat', 'visa'] as Tool[]).map((k) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => open(k)}
              className="flex w-full items-center gap-3 rounded-2xl border border-blush bg-white/80 px-3 py-2.5 text-left transition-colors hover:border-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blush text-rose">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d={ICONS[k]}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-semibold text-plum">
                  {t(`tools.${k}.title`)}
                </span>
                <span className="block text-xs text-mist">{t(`tools.${k}.hint`)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

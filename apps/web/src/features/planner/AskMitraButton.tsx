import { useTranslation } from 'react-i18next';
import { usePanelJump } from './panelJump';

/**
 * "Ask Mitra" in the top bar, next to the language switch (owner request, 2026-10-25).
 * Lazy, so the planner code stays out of first paint.
 */
export default function AskMitraButton() {
  const { t } = useTranslation();
  const jump = usePanelJump();
  return (
    <button
      type="button"
      onClick={() => jump('ask-mitra')}
      className="btn-primary shrink-0 whitespace-nowrap !px-4 !py-1.5 text-sm shadow-soft"
    >
      {t('sections.ask')}
    </button>
  );
}

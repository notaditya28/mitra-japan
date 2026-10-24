import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssistantStore } from './useAssistantStore';

const VISIBLE_MS = 20_000;

/** "Change applied · Undo" after an itinerary patch. */
export function UndoToast() {
  const { t } = useTranslation();
  const undo = useAssistantStore((s) => s.undo);
  const undoLast = useAssistantStore((s) => s.undoLast);
  const clearUndo = useAssistantStore((s) => s.clearUndo);

  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(clearUndo, VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [undo, clearUndo]);

  if (!undo) return null;
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-plum px-4 py-2 text-sm text-paper shadow-lift"
    >
      <span className="max-w-[60vw] truncate">
        {t('assistant.undo.applied', { summary: undo.summary })}
      </span>
      <button
        type="button"
        onClick={() => void undoLast()}
        className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-plum hover:bg-blush"
      >
        {t('assistant.undo.button')}
      </button>
      <button
        type="button"
        onClick={clearUndo}
        aria-label={t('planner.close')}
        className="text-paper/70 hover:text-paper"
      >
        ×
      </button>
    </div>
  );
}

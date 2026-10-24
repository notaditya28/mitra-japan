import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Modal built on the native <dialog>: focus is trapped, Esc closes, the page
 * behind is inert, and focus returns to the opener afterwards.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  children,
  size = 'lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  size?: 'sm' | 'lg' | 'full';
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const width = {
    full: 'h-[100svh] max-h-none w-screen max-w-none rounded-none',
    lg: 'h-[100svh] max-h-none w-screen max-w-none rounded-none sm:h-fit sm:max-h-[90svh] sm:w-[min(92vw,56rem)] sm:rounded-card',
    sm: 'h-fit max-h-[90svh] w-[calc(100vw-2rem)] max-w-md rounded-card',
  }[size];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // React passes close/cancel up the component tree even though the browser doesn't
      // bubble them, so a nested dialog closing would close this one too. Only react to our own.
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
      data-lenis-prevent
      className={`m-auto overflow-hidden border border-blush bg-paper p-0 text-ink shadow-lift backdrop:bg-plum/60 backdrop:backdrop-blur-sm ${width}`}
    >
      {open ? (
        <div className="flex h-full max-h-[inherit] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-blush px-5 py-4 sm:px-6">
            <div>
              {eyebrow ? <p className="eyebrow text-rose">{eyebrow}</p> : null}
              <h2 id={titleId} className="display mt-1 text-2xl text-plum">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('planner.close')}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush text-plum transition-colors hover:bg-petal focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

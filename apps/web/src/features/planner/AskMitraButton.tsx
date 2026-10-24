import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AssistantChat } from '../assistant/AssistantChat';
import { useAskMitra } from '../assistant/useAskMitra';
import { usePanelJump } from './panelJump';
import { usePlannerStore } from './usePlannerStore';

/** AI sparkle: one large four-point star and a small one. */
export function SparkleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z"
        fill="currentColor"
      />
      <path d="M18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" fill="currentColor" />
    </svg>
  );
}

/**
 * Ask Mitra as a floating assistant (owner request, 2026-10-25): an AI button at the bottom
 * left that opens the chat in a pop-up over the planner, like other chat assistants,
 * instead of jumping to a section. On phones it sits above the bottom sheet. The
 * conversation lives in the assistant store, so closing the pop-up loses nothing.
 */
export default function AskMitraButton() {
  const { t } = useTranslation();
  const open = useAskMitra((s) => s.open);
  const setOpen = useAskMitra((s) => s.setOpen);
  const hasPlan = usePlannerStore((s) => s.itinerary !== null);
  const jump = usePanelJump();
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Open dialogs (emergency, sources, trip data) handle Esc themselves first.
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <>
      {open ? (
        <section
          ref={panel}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${panelId}-title`}
          data-lenis-prevent
          className="fixed bottom-[calc(132px+4.5rem)] left-2 right-2 z-50 flex max-h-[calc(100svh-var(--nav-h,61px)-132px-5.5rem)] flex-col overflow-hidden rounded-card border border-blush bg-paper text-ink shadow-lift sm:right-auto sm:w-[400px] lg:bottom-24 lg:left-5 lg:max-h-[calc(100svh-var(--nav-h,61px)-10rem)]"
        >
          <header className="flex items-center gap-3 bg-plum px-4 py-3 text-paper">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose text-white">
              <SparkleIcon />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`${panelId}-title`} className="font-display text-lg leading-tight">
                {t('sections.ask')}
              </h2>
              <p className="text-[11px] text-blush/85">{t('assistant.popup.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t('assistant.popup.close')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-lg hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
            >
              ×
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" data-scroll-box>
            {hasPlan ? null : (
              <p className="mb-3 rounded-2xl bg-blush px-3 py-2 text-xs text-plum">
                {t('assistant.popup.noPlan')}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    jump('trip-options', 'trip-guide');
                  }}
                  className="font-semibold text-rose underline underline-offset-2"
                >
                  {t('assistant.popup.planFirst')}
                </button>
              </p>
            )}
            <AssistantChat />
          </div>
        </section>
      ) : null}

      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={`fixed bottom-[calc(132px+0.75rem)] left-3 z-50 flex items-center gap-2 rounded-full py-2.5 pl-3 pr-4 text-sm font-semibold shadow-lift transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose lg:bottom-6 lg:left-5 ${
          open ? 'bg-plum text-paper' : 'bg-rose text-white hover:bg-plum'
        }`}
      >
        <SparkleIcon />
        {t('sections.ask')}
      </button>
    </>
  );
}

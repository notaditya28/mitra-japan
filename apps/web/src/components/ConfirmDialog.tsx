import { useTranslation } from 'react-i18next';
import { Dialog } from './Dialog';

/** Small yes/no dialog for destructive actions. Cancel is the safe default. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-ink">{body}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="btn-ghost !px-5 !py-2 text-sm text-plum"
        >
          {t('trip.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center justify-center rounded-full bg-torii px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torii"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

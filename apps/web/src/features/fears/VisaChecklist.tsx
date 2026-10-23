import { useTranslation } from 'react-i18next';

/** General visa readiness steps. Owner to confirm against the Embassy of Japan in India (TODO.md). */
export function VisaChecklist() {
  const { t } = useTranslation();
  const steps = t('visa.steps', { returnObjects: true }) as string[];

  return (
    <div className="rounded-2xl border border-blush bg-paper p-4">
      <ol className="space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-matcha/40 text-[11px] font-bold text-plum">
              {i + 1}
            </span>
            <span className="text-ink">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-mist">{t('visa.note')}</p>
    </div>
  );
}

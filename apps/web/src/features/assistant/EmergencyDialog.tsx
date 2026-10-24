import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { useAppStore } from '../../store/useAppStore';
import { usePlannerStore } from '../planner/usePlannerStore';
import { EmergencyCard } from './EmergencyCard';
import { EMERGENCY, EMERGENCY_KINDS, offlineEmergency } from './offline';
import { useAssistantStore } from './useAssistantStore';

/**
 * Emergency mode, opened from "Emergency help". Works with no network at all: everything comes
 * from the bundled emergency.json (official sources, pending owner verification).
 */
export function EmergencyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const itinerary = usePlannerStore((s) => s.itinerary);
  const currentDay = useAssistantStore((s) => s.currentDay);
  const [kind, setKind] = useState<string | null>(null);
  const today = itinerary?.days.find((d) => d.day === currentDay)?.cityId;
  const cities = today ? [today] : (itinerary?.days.map((d) => d.cityId) ?? []);
  const numbers = EMERGENCY.numbers.filter((n) => n.id === 'ambulance-fire' || n.id === 'police');

  return (
    <Dialog
      open={open}
      onClose={() => {
        setKind(null);
        onClose();
      }}
      title={t('assistant.emergency.title')}
      eyebrow={t('assistant.emergency.eyebrow')}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {numbers.map((n) => (
          <a
            key={n.id}
            href={`tel:${n.value}`}
            className="flex items-center justify-between rounded-2xl bg-torii px-4 py-3 text-white shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torii"
          >
            <span className="text-sm font-semibold">{n.label}</span>
            <span className="text-2xl font-bold">{n.value}</span>
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-mist">{t('assistant.emergency.pick')}</p>
      <div
        className="mt-2 flex flex-wrap gap-1.5"
        role="group"
        aria-label={t('assistant.emergency.pick')}
      >
        {EMERGENCY_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              kind === k
                ? 'border-torii bg-torii text-white'
                : 'border-petal bg-blush text-plum hover:border-torii'
            }`}
          >
            {t(`assistant.emergency.kinds.${k}`)}
          </button>
        ))}
      </div>
      <div className="mt-4" aria-live="polite">
        {kind ? <EmergencyCard payload={offlineEmergency(kind, cities, language)} /> : null}
      </div>
    </Dialog>
  );
}

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { usePlannerStore } from '../planner/usePlannerStore';
import { useTools } from '../tools/useTools';
import { EmergencyDialog } from './EmergencyDialog';
import { MessageView } from './MessageView';
import { nearbyFood } from './offline';
import { SourcesDrawer } from './SourcesDrawer';
import { TripDataDialog } from './TripDataDialog';
import { useAskMitra } from './useAskMitra';
import { useAssistantStore, type AssistantMessage } from './useAssistantStore';

const QUICK = ['visa', 'veg', 'tired', 'rain', 'wrong', 'menu'] as const;

/** Ask Mitra: grounded answers with sources, trip changes as previews, and emergency help. */
export function AssistantChat() {
  const { t } = useTranslation();
  const id = useId();
  const messages = useAssistantStore((s) => s.messages);
  const sending = useAssistantStore((s) => s.sending);
  const send = useAssistantStore((s) => s.send);
  const addLocal = useAssistantStore((s) => s.addLocal);
  const location = useAssistantStore((s) => s.location);
  const setLocation = useAssistantStore((s) => s.setLocation);
  const currentDay = useAssistantStore((s) => s.currentDay);
  const setCurrentDay = useAssistantStore((s) => s.setCurrentDay);
  const applyProposal = useAssistantStore((s) => s.applyProposal);
  const dismissProposal = useAssistantStore((s) => s.dismissProposal);
  const itinerary = usePlannerStore((s) => s.itinerary);
  const focusDay = usePlannerStore((s) => s.focusDay);
  const draft = useAskMitra((s) => s.draft);
  const takeDraft = useAskMitra((s) => s.takeDraft);
  const diet = useAppStore((s) => s.diet);
  const openTool = useTools((s) => s.open);
  const [text, setText] = useState('');
  const [sources, setSources] = useState<{ messageId: string; n: number } | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // A question handed over from elsewhere (e.g. a prefecture card) waits in the box to be sent.
  useEffect(() => {
    if (!draft) return;
    setText(draft);
    takeDraft();
    box.current?.focus();
  }, [draft, takeDraft]);

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, sending]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    void send(text);
    setText('');
  };

  const showNearby = (loc: { lat: number; lng: number }) => {
    const places = nearbyFood(loc.lat, loc.lng, diet);
    addLocal({
      kind: 'nearby',
      text: t('assistant.nearby.title', { diet: t(`diets.${diet}`) }),
      data: places,
    });
  };

  const locate = (then?: (loc: { lat: number; lng: number }) => void) => {
    if (!('geolocation' in navigator)) {
      addLocal({ kind: 'info', text: t('assistant.location.unsupported') });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        then?.(loc);
      },
      () => {
        setLocating(false);
        addLocal({ kind: 'info', text: t('assistant.location.denied') });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const quick = (k: (typeof QUICK)[number]) => {
    if (k === 'wrong') return setEmergencyOpen(true);
    if (k === 'menu') return openTool('scan');
    if (k === 'veg') {
      if (location) return showNearby(location);
      return locate(showNearby);
    }
    void send(t(`assistant.quickPrompts.${k}`));
  };

  const sourceMessage = sources
    ? (messages.find((m) => m.id === sources.messageId) as AssistantMessage | undefined)
    : undefined;

  return (
    <section
      id="ask-mitra"
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-2 flex-col gap-3"
    >
      <div className="flex items-center justify-end gap-2">
        {/* The pop-up header already shows the name. */}
        <h3 id={`${id}-title`} className="sr-only">
          {t('assistant.title')}
        </h3>
        <button
          type="button"
          onClick={() => setEmergencyOpen(true)}
          className="rounded-full bg-torii px-3 py-1 text-xs font-bold text-white shadow-soft hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torii"
        >
          {t('assistant.emergency.button')}
        </button>
      </div>

      {itinerary ? (
        <label className="flex items-center gap-2 text-xs text-plum">
          {t('assistant.today')}
          <select
            value={currentDay ?? ''}
            onChange={(e) => setCurrentDay(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-petal bg-paper px-2 py-1 text-xs"
          >
            <option value="">{t('assistant.notStarted')}</option>
            {itinerary.days.map((d) => (
              <option key={d.day} value={d.day}>
                {t('trip.day', { n: d.day })}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div
        ref={thread}
        aria-live="polite"
        aria-busy={sending}
        className="flex max-h-[26rem] min-h-[3rem] flex-col gap-2 overflow-y-auto pr-1"
        data-lenis-prevent
      >
        {messages.length === 0 ? <p className="text-xs text-mist">{t('assistant.empty')}</p> : null}
        {messages.map((m) => (
          <MessageView
            key={m.id}
            m={m}
            onSource={(n) => setSources({ messageId: m.id, n })}
            onApply={() => {
              // Once applied, show the changed day in the planner (day card + map).
              const day =
                m.role === 'assistant'
                  ? m.response.proposed_patch?.diff?.days.find((d) => d.status !== 'unchanged')
                      ?.day
                  : undefined;
              void applyProposal(m.id).then(() => {
                const now = useAssistantStore.getState().messages.find((x) => x.id === m.id);
                if (day && now?.role === 'assistant' && now.patchState === 'applied') focusDay(day);
              });
            }}
            onEdit={() => {
              const i = messages.findIndex((x) => x.id === m.id);
              const prev = messages
                .slice(0, i)
                .reverse()
                .find((x) => x.role === 'user');
              setText(prev && prev.role === 'user' ? prev.text : '');
              dismissProposal(m.id);
              box.current?.focus();
            }}
            onDismiss={() => dismissProposal(m.id)}
            onEmergency={() => setEmergencyOpen(true)}
          />
        ))}
        {sending ? (
          <p className="flex items-center gap-2 text-xs text-plum">
            <span aria-hidden="true" className="h-2 w-2 animate-ping rounded-full bg-sakura" />
            {t('assistant.thinking')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('assistant.quickLabel')}>
        {QUICK.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => quick(k)}
            disabled={sending && k !== 'wrong'}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
              k === 'wrong'
                ? 'border-torii/50 bg-torii/10 text-torii hover:border-torii'
                : 'border-petal bg-blush text-plum hover:border-rose'
            }`}
          >
            {t(`assistant.quick.${k}`)}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex items-end gap-2">
        <label htmlFor={`${id}-input`} className="sr-only">
          {t('assistant.inputLabel')}
        </label>
        <textarea
          ref={box}
          id={`${id}-input`}
          value={text}
          rows={2}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          placeholder={itinerary ? t('assistant.placeholderTrip') : t('assistant.placeholder')}
          className="min-w-0 flex-1 resize-none rounded-2xl border border-petal bg-white/80 px-3 py-2 text-sm text-ink outline-none transition focus:border-rose focus:ring-2 focus:ring-rose/30"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="btn-primary !px-4 !py-2.5 text-sm disabled:opacity-50"
        >
          {t('assistant.send')}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {location ? (
          <span className="text-plum">
            {t('assistant.location.on')}{' '}
            <button
              type="button"
              onClick={() => setLocation(null)}
              className="font-semibold text-rose underline-offset-4 hover:underline"
            >
              {t('assistant.location.off')}
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => locate()}
            disabled={locating}
            className="font-semibold text-rose underline-offset-4 hover:underline"
          >
            {locating ? t('assistant.location.finding') : t('assistant.location.use')}
          </button>
        )}
        <button
          type="button"
          onClick={() => setDataOpen(true)}
          className="font-semibold text-rose underline-offset-4 hover:underline"
        >
          {t('assistant.data.open')}
        </button>
      </div>

      <SourcesDrawer
        citations={sourceMessage?.response.citations ?? []}
        focus={sources?.n ?? null}
        open={sources !== null}
        onClose={() => setSources(null)}
      />
      <EmergencyDialog open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
      <TripDataDialog open={dataOpen} onClose={() => setDataOpen(false)} />
    </section>
  );
}

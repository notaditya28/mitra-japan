import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Dialog } from '../../components/Dialog';
import { getServerTripData } from './assistantApi';
import { buildTripContext, useAssistantStore } from './useAssistantStore';

type ServerState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ok'; stored: boolean; storage: string };

/** "View my trip data" and "Delete my trip data": exactly what the assistant knows, and where. */
export function TripDataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const sessionId = useAssistantStore((s) => s.sessionId);
  const pinned = useAssistantStore((s) => s.pinned);
  const currentDay = useAssistantStore((s) => s.currentDay);
  const messages = useAssistantStore((s) => s.messages.length);
  const location = useAssistantStore((s) => s.location);
  const deleteAll = useAssistantStore((s) => s.deleteAll);
  const [server, setServer] = useState<ServerState>({ status: 'loading' });
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const ctx = buildTripContext(sessionId, pinned, currentDay);

  useEffect(() => {
    if (!open) return;
    setServer({ status: 'loading' });
    void getServerTripData(sessionId).then((r) =>
      setServer(
        r.ok
          ? { status: 'ok', stored: r.value.stored_on_server, storage: r.value.storage }
          : { status: 'offline' },
      ),
    );
  }, [open, sessionId]);

  const rows: [string, string, string][] = [
    [
      t('assistant.data.diet'),
      ctx.diet ? ctx.diet.value.diet : t('assistant.data.none'),
      ctx.diet ? t('assistant.provenance.user-provided') : '',
    ],
    [
      t('assistant.data.style'),
      ctx.travel_style ? String(ctx.travel_style.value) : t('assistant.data.none'),
      ctx.travel_style ? t('assistant.provenance.user-provided') : '',
    ],
    [
      t('assistant.data.itinerary'),
      ctx.itinerary
        ? t('trips.days', { count: ctx.itinerary.days.length })
        : t('assistant.data.none'),
      ctx.itinerary ? t('assistant.provenance.confirmed') : '',
    ],
    [
      t('assistant.data.today'),
      ctx.current_day ? t('trip.day', { n: ctx.current_day }) : t('assistant.data.notStarted'),
      ctx.current_day ? t('assistant.provenance.user-provided') : '',
    ],
    [
      t('assistant.data.pinned'),
      pinned.length ? pinned.map((p) => p.split('|')[1]).join(', ') : t('assistant.data.none'),
      '',
    ],
    [t('assistant.data.messages'), String(messages), ''],
    [
      t('assistant.data.location'),
      location ? t('assistant.data.locationOn') : t('assistant.data.locationOff'),
      '',
    ],
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('assistant.data.title')}
      eyebrow={t('assistant.data.eyebrow')}
    >
      <p className="text-sm text-mist">{t('assistant.data.intro')}</p>
      <table className="mt-4 w-full text-left text-sm">
        <tbody>
          {rows.map(([k, v, prov]) => (
            <tr key={k} className="border-b border-blush">
              <th scope="row" className="py-2 pr-3 align-top text-xs font-semibold text-plum">
                {k}
              </th>
              <td className="py-2 text-ink">
                {v}
                {prov ? (
                  <span className="ml-2 rounded-full bg-blush px-2 py-0.5 text-[10px] text-plum">
                    {prov}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-mist">{t('assistant.data.never')}</p>
      <p className="mt-2 text-xs text-plum" aria-live="polite">
        {server.status === 'loading'
          ? t('assistant.data.serverLoading')
          : server.status === 'offline'
            ? t('assistant.data.serverOffline')
            : server.stored
              ? t('assistant.data.serverStored', { storage: server.storage })
              : t('assistant.data.serverNone')}
      </p>
      <p className="mt-1 text-[11px] text-mist">
        {t('assistant.data.session', { id: sessionId.slice(0, 8) })}
      </p>
      {done ? (
        <p role="status" className="mt-3 rounded-xl bg-matcha/30 px-3 py-2 text-sm text-plum">
          {done}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="mt-4 rounded-full bg-torii px-5 py-2 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-torii"
      >
        {t('assistant.data.delete')}
      </button>
      <ConfirmDialog
        open={confirm}
        title={t('assistant.data.deleteTitle')}
        body={t('assistant.data.deleteBody')}
        confirmLabel={t('assistant.data.delete')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void deleteAll().then((r) => {
            setDone(r.server ? t('assistant.data.deleted') : t('assistant.data.deletedLocal'));
            setServer({ status: 'ok', stored: false, storage: '' });
          });
        }}
      />
    </Dialog>
  );
}

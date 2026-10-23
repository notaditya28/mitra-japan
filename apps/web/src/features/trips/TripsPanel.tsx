import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore } from '../../store/useAppStore';
import { buildTripDocument } from '../export/tripDocument';
import { usePrint } from '../export/usePrint';
import { cityById } from '../planner/data';
import { usePlannerStore } from '../planner/usePlannerStore';
import { useTools } from '../tools/useTools';
import { NAME_MAX, NOTES_MAX, useTrips, type SavedTrip, type TripError } from './tripsStore';

const FIELD =
  'mt-1 w-full rounded-xl border border-petal bg-paper px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/40';
const ACTION =
  'rounded-full bg-blush px-3 py-1.5 text-xs font-semibold text-plum transition-colors hover:bg-petal focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose';

function EditForm({ trip, onDone }: { trip: SavedTrip; onDone: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const edit = useTrips((s) => s.edit);
  const [name, setName] = useState(trip.name);
  const [notes, setNotes] = useState(trip.notes);
  const [error, setError] = useState<TripError | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = edit(trip.id, { name, notes });
    if (err) return setError(err);
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-2">
      <div>
        <label htmlFor={`${id}-name`} className="text-xs font-semibold text-plum">
          {t('trips.name')}
        </label>
        <input
          id={`${id}-name`}
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor={`${id}-notes`} className="text-xs font-semibold text-plum">
          {t('trips.notes')}
        </label>
        <textarea
          id={`${id}-notes`}
          value={notes}
          rows={2}
          maxLength={NOTES_MAX}
          onChange={(e) => setNotes(e.target.value)}
          className={FIELD}
        />
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs font-semibold text-torii">
          {t(`trips.errors.${error}`)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary !px-4 !py-1.5 text-xs">
          {t('trips.saveEdit')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs font-semibold text-rose underline-offset-4 hover:underline"
        >
          {t('trip.cancel')}
        </button>
      </div>
    </form>
  );
}

/** My trips: open, edit, duplicate, print or delete (with confirmation). Browser only. */
export default function TripsPanel() {
  const { t, i18n } = useTranslation();
  const trips = useTrips((s) => s.trips);
  const storageError = useTrips((s) => s.storageError);
  const duplicate = useTrips((s) => s.duplicate);
  const remove = useTrips((s) => s.remove);
  const openTrip = usePlannerStore((s) => s.openTrip);
  const activeTripId = usePlannerStore((s) => s.activeTripId);
  const setActiveTrip = usePlannerStore((s) => s.setActiveTrip);
  const setDiet = useAppStore((s) => s.setDiet);
  const setPersona = useAppStore((s) => s.setPersona);
  const close = useTools((s) => s.close);
  const print = usePrint((s) => s.print);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedTrip | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const open = (trip: SavedTrip) => {
    setDiet(trip.diet);
    if (trip.persona) setPersona(trip.persona);
    openTrip(trip.id, trip.itinerary);
    close();
  };

  const copy = (trip: SavedTrip) => {
    const r = duplicate(trip.id, t('trips.copyLabel'));
    setMessage(
      'error' in r ? t(`trips.errors.${r.error}`) : t('trips.duplicated', { name: trip.name }),
    );
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove(deleting.id);
    if (activeTripId === deleting.id) setActiveTrip(null);
    setMessage(t('trips.deleted', { name: deleting.name }));
    setDeleting(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mist">{t('trips.intro')}</p>
      {storageError ? (
        <p role="alert" className="rounded-xl bg-torii/10 p-3 text-sm font-semibold text-torii">
          {t('trips.errors.storage')}
        </p>
      ) : null}
      <p aria-live="polite" className="text-xs font-semibold text-plum empty:hidden">
        {message}
      </p>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-petal p-8 text-center text-sm text-mist">
          <p className="font-display text-xl text-plum">{t('trips.empty')}</p>
          <p className="mt-1">{t('trips.emptyHint')}</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {trips.map((trip) => {
            const cities = [...new Set(trip.itinerary.days.map((d) => d.cityId))]
              .map((c) => cityById(c)?.name ?? c)
              .join(' → ');
            return (
              <li key={trip.id} className="rounded-2xl border border-blush bg-white/80 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-plum">{trip.name}</h3>
                    <p className="text-xs text-mist">
                      {t('trips.days', { count: trip.itinerary.days.length })} · {cities}
                    </p>
                  </div>
                  {trip.itinerary.source === 'sample' ? <StatusBadge status="sample" /> : null}
                </div>
                <p className="mt-1 text-xs text-mist">
                  {t(`diets.${trip.diet}`)} · {t('trips.updatedOn', { date: fmt(trip.updatedAt) })}
                </p>
                {trip.notes ? <p className="mt-2 text-sm text-ink">{trip.notes}</p> : null}
                {trip.booking ? (
                  <p className="mt-2 inline-block rounded-full bg-gold/25 px-2 py-0.5 text-[11px] font-semibold text-plum">
                    {t('booking.badge', { ref: trip.booking.ref })}
                  </p>
                ) : null}

                {editing === trip.id ? (
                  <EditForm trip={trip} onDone={() => setEditing(null)} />
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => open(trip)}
                      className="btn-primary !px-4 !py-1.5 text-xs"
                    >
                      {t('trips.open')}
                      <span className="sr-only">: {trip.name}</span>
                    </button>
                    <button type="button" onClick={() => setEditing(trip.id)} className={ACTION}>
                      {t('trips.edit')}
                      <span className="sr-only">: {trip.name}</span>
                    </button>
                    <button type="button" onClick={() => copy(trip)} className={ACTION}>
                      {t('trips.duplicate')}
                      <span className="sr-only">: {trip.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        print(
                          buildTripDocument(trip.name, trip.itinerary, trip.diet),
                          trip.booking,
                        );
                      }}
                      className={ACTION}
                    >
                      {t('export.pdf')}
                      <span className="sr-only">: {trip.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(trip)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-torii hover:bg-torii/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-torii"
                    >
                      {t('trips.delete')}
                      <span className="sr-only">: {trip.name}</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-mist">{t('trips.storageNote')}</p>

      <ConfirmDialog
        open={deleting !== null}
        title={t('trips.deleteTitle')}
        body={t('trips.deleteBody', { name: deleting?.name ?? '' })}
        confirmLabel={t('trips.delete')}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

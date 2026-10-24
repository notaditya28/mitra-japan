import { useTripPrefs } from '../planner/tripPrefs';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { buildTripDocument } from '../export/tripDocument';
import { shareText, whatsappUrl } from '../export/share';
import { usePrint } from '../export/usePrint';
import type { Itinerary } from '../planner/itinerary';
import { usePlannerStore } from '../planner/usePlannerStore';
import { useTools } from '../tools/useTools';
import { defaultTripName } from './tripName';
import { NAME_MAX, NOTES_MAX, useTrips, type TripError } from './tripsStore';

const FIELD =
  'mt-1 w-full rounded-xl border border-petal bg-paper px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/40';
const SMALL_BTN =
  'inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1.5 text-xs font-semibold text-plum transition-colors hover:bg-petal focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose';

/** Save / update the trip, print it, share it on WhatsApp, or try the demo booking. */
export function TripActions({ itinerary }: { itinerary: Itinerary }) {
  const { t } = useTranslation();
  const id = useId();
  const diet = useAppStore((s) => s.diet);
  const persona = useAppStore((s) => s.persona);
  const language = useAppStore((s) => s.language);
  const activeTripId = usePlannerStore((s) => s.activeTripId);
  const setActiveTrip = usePlannerStore((s) => s.setActiveTrip);
  const trip = useTrips((s) => s.trips.find((x) => x.id === activeTripId));
  const create = useTrips((s) => s.create);
  const replaceItinerary = useTrips((s) => s.replaceItinerary);
  const print = usePrint((s) => s.print);
  const openTool = useTools((s) => s.open);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<TripError | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const unsaved = trip ? trip.itinerary !== itinerary || trip.diet !== diet : true;
  const tripName = trip?.name ?? defaultTripName(itinerary, t);

  const startSave = () => {
    setName(defaultTripName(itinerary, t));
    setNotes('');
    setError(null);
    setSaving(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = create({ name, notes, persona, diet, language, itinerary });
    if ('error' in r) {
      setError(r.error);
      if (r.error !== 'storage') return;
    } else {
      setActiveTrip(r.id);
    }
    setSaving(false);
    setStatus(t('trips.saved'));
  };

  const saveChanges = () => {
    if (!trip) return;
    replaceItinerary(trip.id, itinerary, diet);
    setStatus(t('trips.updated'));
  };

  const groupDiets = useTripPrefs((s) => s.prefs.diets);
  const share = whatsappUrl(shareText(tripName, itinerary, t, [diet, ...groupDiets]));

  return (
    <div className="rounded-2xl border border-blush bg-white/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {trip && !unsaved ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-plum">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-matcha" />
            {t('trips.savedAs', { name: trip.name })}
          </span>
        ) : trip ? (
          <button type="button" onClick={saveChanges} className="btn-primary !px-4 !py-1.5 text-xs">
            {t('trips.saveChanges')}
          </button>
        ) : (
          <button
            type="button"
            onClick={startSave}
            aria-expanded={saving}
            className="btn-primary !px-4 !py-1.5 text-xs"
          >
            {t('trips.save')}
          </button>
        )}
        <button
          type="button"
          onClick={() => print(buildTripDocument(tripName, itinerary, diet), trip?.booking)}
          className={SMALL_BTN}
        >
          {t('export.pdf')}
        </button>
        <a href={share} target="_blank" rel="noopener noreferrer" className={SMALL_BTN}>
          {t('export.whatsapp')}
          <span className="sr-only"> ({t('restaurants.newTab')})</span>
        </a>
        <button type="button" onClick={() => openTool('book')} className={SMALL_BTN}>
          {trip?.booking ? t('booking.view') : t('booking.open')}
        </button>
      </div>

      {saving ? (
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
              aria-invalid={error === 'name' ? true : undefined}
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
              {t('trips.saveConfirm')}
            </button>
            <button
              type="button"
              onClick={() => setSaving(false)}
              className="text-xs font-semibold text-rose underline-offset-4 hover:underline"
            >
              {t('trip.cancel')}
            </button>
          </div>
          <p className="text-[11px] text-mist">{t('trips.storageNote')}</p>
        </form>
      ) : null}

      <p aria-live="polite" className="mt-1 text-xs text-mist empty:hidden">
        {status}
      </p>
    </div>
  );
}

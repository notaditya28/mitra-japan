import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { addDays, localDay } from '../../lib/dates';
import { useAppStore } from '../../store/useAppStore';
import { formatPhone } from '../auth/demoAuth';
import { cityById } from '../planner/data';
import { usePlannerStore } from '../planner/usePlannerStore';
import { defaultTripName } from '../trips/tripName';
import { useTrips } from '../trips/tripsStore';
import {
  MAX_TRAVELLERS,
  demoRef,
  validateBooking,
  type BookingErrors,
  type BookingForm,
} from './booking';

const FIELD =
  'mt-1 w-full rounded-xl border border-petal bg-paper px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/40';

const plusDays = (n: number) => localDay(addDays(new Date(), n));

function DemoBanner() {
  const { t } = useTranslation();
  return (
    <p
      role="note"
      className="rounded-2xl border-2 border-dashed border-gold bg-gold/15 px-4 py-3 text-sm font-semibold text-plum"
    >
      {t('booking.banner')}
    </p>
  );
}

/**
 * Mock booking (owner decision): review the trip, enter who is travelling,
 * get a clearly fake reference. Nothing is booked, paid or sent anywhere,
 * and no prices are shown because we have none.
 */
export default function BookingPanel() {
  const { t } = useTranslation();
  const id = useId();
  const user = useAppStore((s) => s.user);
  const diet = useAppStore((s) => s.diet);
  const persona = useAppStore((s) => s.persona);
  const language = useAppStore((s) => s.language);
  const itinerary = usePlannerStore((s) => s.itinerary);
  const activeTripId = usePlannerStore((s) => s.activeTripId);
  const setActiveTrip = usePlannerStore((s) => s.setActiveTrip);
  const trip = useTrips((s) => s.trips.find((x) => x.id === activeTripId));
  const create = useTrips((s) => s.create);
  const setBooking = useTrips((s) => s.setBooking);
  const [form, setForm] = useState<BookingForm>({
    startDate: plusDays(60),
    adults: 2,
    children: 0,
    seniors: persona === 'family' ? 2 : 0,
    rooms: persona === 'family' ? 2 : 1,
    leadName: user?.name ?? '',
    notes: '',
  });
  const [errors, setErrors] = useState<BookingErrors>({});
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [cancelling, setCancelling] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!itinerary) {
    return <p className="py-8 text-center text-sm text-mist">{t('booking.needPlan')}</p>;
  }

  const booking = trip?.booking ?? null;
  const set = <K extends keyof BookingForm>(k: K, v: BookingForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const err = (k: keyof BookingErrors) => (errors[k] ? t(`booking.errors.${errors[k]}`) : null);

  const review = (e: FormEvent) => {
    e.preventDefault();
    const found = validateBooking(form);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep('review');
  };

  const confirm = () => {
    let tripId = trip?.id ?? null;
    if (!tripId) {
      const r = create({
        name: defaultTripName(itinerary, t),
        notes: '',
        persona,
        diet,
        language,
        itinerary,
      });
      if ('error' in r) {
        setSaveError(t(`trips.errors.${r.error}`));
        return;
      }
      tripId = r.id;
      setActiveTrip(r.id);
    }
    setBooking(tripId, {
      ref: demoRef(),
      createdAt: new Date().toISOString(),
      startDate: form.startDate,
      adults: form.adults,
      children: form.children,
      seniors: form.seniors,
      rooms: form.rooms,
      leadName: form.leadName.trim(),
      notes: form.notes.trim(),
    });
    setStep('form');
  };

  if (booking) {
    return (
      <div className="flex flex-col gap-4">
        <DemoBanner />
        <div className="rounded-card border border-blush bg-white p-6 text-center">
          <p className="eyebrow text-rose">{t('booking.doneEyebrow')}</p>
          <p className="display mt-2 text-3xl text-plum">{booking.ref}</p>
          <p className="mt-2 text-sm text-ink">
            {t('booking.doneBody', {
              name: booking.leadName,
              date: booking.startDate,
              people: booking.adults + booking.children + booking.seniors,
              rooms: booking.rooms,
            })}
          </p>
          <p className="mt-3 text-sm font-semibold text-torii">{t('booking.notReal')}</p>
        </div>
        <section className="rounded-2xl bg-blush/60 p-4 text-sm text-plum">
          <h3 className="font-semibold">{t('booking.nextTitle')}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{t('booking.next.rail')}</li>
            <li>{t('booking.next.stay')}</li>
            <li>{t('booking.next.visa')}</li>
            <li>{t('booking.next.food')}</li>
          </ul>
        </section>
        <button
          type="button"
          onClick={() => setCancelling(true)}
          className="self-start text-sm font-semibold text-torii underline-offset-4 hover:underline"
        >
          {t('booking.cancel')}
        </button>
        <ConfirmDialog
          open={cancelling}
          title={t('booking.cancelTitle')}
          body={t('booking.cancelBody', { ref: booking.ref })}
          confirmLabel={t('booking.cancelConfirm')}
          onCancel={() => setCancelling(false)}
          onConfirm={() => {
            if (trip) setBooking(trip.id, null);
            setCancelling(false);
          }}
        />
      </div>
    );
  }

  const cities = [...new Set(itinerary.days.map((d) => d.cityId))]
    .map((c) => cityById(c)?.name ?? c)
    .join(' → ');
  const people = form.adults + form.children + form.seniors;

  return (
    <div className="flex flex-col gap-5">
      <DemoBanner />

      <section className="rounded-2xl border border-blush bg-white/80 p-4">
        <h3 className="text-sm font-semibold text-plum">{t('booking.tripTitle')}</h3>
        <p className="mt-1 text-sm text-ink">
          {trip?.name ?? defaultTripName(itinerary, t)} · {cities}
        </p>
        <p className="mt-1 text-xs text-mist">
          {t('trips.days', { count: itinerary.days.length })} · {t(`diets.${diet}`)} ·{' '}
          {t('booking.noPrices')}
        </p>
      </section>

      {step === 'form' ? (
        <form onSubmit={review} noValidate className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-date`} className="text-xs font-semibold text-plum">
              {t('booking.startDate')}
            </label>
            <input
              id={`${id}-date`}
              type="date"
              value={form.startDate}
              min={plusDays(0)}
              max={plusDays(365)}
              onChange={(e) => set('startDate', e.target.value)}
              aria-invalid={errors.startDate ? true : undefined}
              aria-describedby={errors.startDate ? `${id}-date-err` : undefined}
              className={FIELD}
            />
            {err('startDate') ? (
              <p id={`${id}-date-err`} className="mt-1 text-xs font-semibold text-torii">
                {err('startDate')}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${id}-lead`} className="text-xs font-semibold text-plum">
              {t('booking.leadName')}
            </label>
            <input
              id={`${id}-lead`}
              value={form.leadName}
              autoComplete="name"
              onChange={(e) => set('leadName', e.target.value)}
              aria-invalid={errors.leadName ? true : undefined}
              aria-describedby={errors.leadName ? `${id}-lead-err` : undefined}
              className={FIELD}
            />
            {err('leadName') ? (
              <p id={`${id}-lead-err`} className="mt-1 text-xs font-semibold text-torii">
                {err('leadName')}
              </p>
            ) : user ? (
              <p className="mt-1 text-xs text-mist">
                {t('booking.contact', { phone: formatPhone(user.phone) })}
              </p>
            ) : null}
          </div>

          <fieldset
            className="sm:col-span-2"
            aria-describedby={errors.travellers ? `${id}-trav-err` : undefined}
          >
            <legend className="text-xs font-semibold text-plum">
              {t('booking.travellers', { max: MAX_TRAVELLERS })}
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['adults', 'seniors', 'children', 'rooms'] as const).map((k) => (
                <div key={k}>
                  <label htmlFor={`${id}-${k}`} className="text-xs text-mist">
                    {t(`booking.counts.${k}`)}
                  </label>
                  <input
                    id={`${id}-${k}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_TRAVELLERS}
                    value={form[k]}
                    onChange={(e) => set(k, Number.parseInt(e.target.value || '0', 10))}
                    aria-invalid={
                      (k === 'rooms' ? errors.rooms : errors.travellers) ? true : undefined
                    }
                    className={FIELD}
                  />
                </div>
              ))}
            </div>
            {err('travellers') || err('rooms') ? (
              <p id={`${id}-trav-err`} className="mt-1 text-xs font-semibold text-torii">
                {err('travellers') ?? err('rooms')}
              </p>
            ) : null}
          </fieldset>

          <div className="sm:col-span-2">
            <label htmlFor={`${id}-notes`} className="text-xs font-semibold text-plum">
              {t('booking.notes')}
            </label>
            <textarea
              id={`${id}-notes`}
              rows={2}
              maxLength={300}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={t('booking.notesPlaceholder')}
              className={FIELD}
            />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary !px-6 !py-2.5 text-sm">
              {t('booking.reviewButton')}
            </button>
          </div>
        </form>
      ) : (
        <section aria-labelledby={`${id}-review`} className="flex flex-col gap-3">
          <h3 id={`${id}-review`} className="font-display text-xl text-plum">
            {t('booking.reviewTitle')}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-mist">{t('booking.startDate')}</dt>
            <dd className="text-ink">{form.startDate}</dd>
            <dt className="text-mist">{t('booking.leadName')}</dt>
            <dd className="text-ink">{form.leadName}</dd>
            <dt className="text-mist">{t('booking.people')}</dt>
            <dd className="text-ink">
              {t('booking.peopleValue', {
                people,
                adults: form.adults,
                seniors: form.seniors,
                children: form.children,
              })}
            </dd>
            <dt className="text-mist">{t('booking.counts.rooms')}</dt>
            <dd className="text-ink">{form.rooms}</dd>
            {form.notes ? (
              <>
                <dt className="text-mist">{t('booking.notes')}</dt>
                <dd className="text-ink">{form.notes}</dd>
              </>
            ) : null}
          </dl>
          <p className="text-xs text-mist">{t('booking.reviewNote')}</p>
          {saveError ? (
            <p role="alert" className="text-xs font-semibold text-torii">
              {saveError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={confirm} className="btn-primary !px-6 !py-2.5 text-sm">
              {t('booking.confirmButton')}
            </button>
            <button
              type="button"
              onClick={() => setStep('form')}
              className="btn-ghost !px-5 !py-2 text-sm text-plum"
            >
              {t('booking.back')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

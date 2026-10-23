import { addDays, localDay } from '../../lib/dates';

export interface BookingForm {
  startDate: string;
  adults: number;
  children: number;
  seniors: number;
  rooms: number;
  leadName: string;
  notes: string;
}

export type BookingField = keyof BookingForm | 'travellers';
export type BookingErrors = Partial<Record<BookingField, string>>;

export const MAX_TRAVELLERS = 12;

/** Returns i18n keys (under booking.errors) for each invalid field. */
export function validateBooking(f: BookingForm, today = new Date()): BookingErrors {
  const e: BookingErrors = {};
  const start = /^\d{4}-\d{2}-\d{2}$/.test(f.startDate)
    ? new Date(`${f.startDate}T00:00:00Z`)
    : null;
  const min = localDay(today);
  const max = localDay(addDays(today, 365));
  if (!start || Number.isNaN(start.getTime())) e.startDate = 'dateMissing';
  else if (f.startDate < min) e.startDate = 'datePast';
  else if (f.startDate > max) e.startDate = 'dateFar';

  const counts = [f.adults, f.children, f.seniors, f.rooms];
  if (counts.some((n) => !Number.isInteger(n) || n < 0)) e.travellers = 'countInvalid';
  else if (f.adults + f.seniors < 1) e.travellers = 'needAdult';
  else if (f.adults + f.children + f.seniors > MAX_TRAVELLERS) e.travellers = 'tooMany';
  if (!e.travellers && (f.rooms < 1 || f.rooms > f.adults + f.children + f.seniors))
    e.rooms = 'roomsInvalid';

  if (f.leadName.trim().length < 2) e.leadName = 'nameShort';
  if (f.notes.length > 300) e.notes = 'notesLong';
  return e;
}

/** A reference that cannot be mistaken for a real booking number. */
export function demoRef(random = Math.random): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(random() * alphabet.length)] ?? 'X';
  return `MJ-DEMO-${s}`;
}

import { describe, expect, it } from 'vitest';
import { demoRef, validateBooking, type BookingForm } from './booking';

const today = new Date('2026-10-24T09:00:00Z');
const ok: BookingForm = {
  startDate: '2027-04-01',
  adults: 2,
  children: 1,
  seniors: 2,
  rooms: 2,
  leadName: 'Asha Patel',
  notes: '',
};

describe('demo booking', () => {
  it('accepts a sensible request', () => {
    expect(validateBooking(ok, today)).toEqual({});
  });

  it('checks dates, travellers, rooms and the lead name', () => {
    expect(validateBooking({ ...ok, startDate: '' }, today).startDate).toBe('dateMissing');
    expect(validateBooking({ ...ok, startDate: '2026-10-01' }, today).startDate).toBe('datePast');
    expect(validateBooking({ ...ok, startDate: '2028-01-01' }, today).startDate).toBe('dateFar');
    expect(validateBooking({ ...ok, adults: 0, seniors: 0 }, today).travellers).toBe('needAdult');
    expect(validateBooking({ ...ok, adults: 12 }, today).travellers).toBe('tooMany');
    expect(validateBooking({ ...ok, adults: -1 }, today).travellers).toBe('countInvalid');
    expect(validateBooking({ ...ok, rooms: 0 }, today).rooms).toBe('roomsInvalid');
    expect(validateBooking({ ...ok, rooms: 9 }, today).rooms).toBe('roomsInvalid');
    expect(validateBooking({ ...ok, leadName: ' A ' }, today).leadName).toBe('nameShort');
  });

  it('makes references that are clearly demo', () => {
    const ref = demoRef(() => 0);
    expect(ref).toBe('MJ-DEMO-AAAAAA');
    expect(demoRef()).toMatch(/^MJ-DEMO-[A-Z2-9]{6}$/);
  });
});

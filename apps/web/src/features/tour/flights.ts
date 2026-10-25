import flights from '../../data/flights.json';

/** Non-stop India -> Japan routes and fares (data/flights.json). Three-free. */
export interface FlightRoute {
  id: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  airline: string;
  flight: string | null;
  frequency: string;
  sourceUrl: string;
  fare: {
    amount: number;
    currency: string;
    trip: string;
    cabin: string;
    travelDates: string;
    seenOn: string;
    sourceUrl: string;
  } | null;
}

export const ROUTES = flights.routes as FlightRoute[];
export const UPCOMING = flights.upcoming;

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "25 Oct 2026" from an ISO date, without time-zone surprises. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export const FLIGHTS_CHECKED = flights.lastChecked;

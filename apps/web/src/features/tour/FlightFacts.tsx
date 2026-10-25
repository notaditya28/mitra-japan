import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../components/StatusBadge';
import { FLIGHTS_CHECKED, ROUTES, UPCOMING, inr, shortDate } from './flights';

/**
 * Non-stop flights from India to Japan (owner request, 2026-10-25), shown during the
 * Delhi -> Japan flight. Only fares we read on the airline's own site, with the date seen;
 * never live prices. Routes without a confirmed fare say to check with the airline.
 */
export function FlightFacts({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const cheapest = ROUTES.filter((r) => r.fare).sort((a, b) => (a.fare?.amount ?? 0) - (b.fare?.amount ?? 0))[0];
  return (
    <aside aria-labelledby="flight-facts-title" className={className}>
      <p className="eyebrow text-gold">{t('tour.flights.eyebrow')}</p>
      <h3 id="flight-facts-title" className="display mt-1 text-xl sm:text-2xl">
        {t('tour.flights.title', { count: ROUTES.length })}
      </h3>
      {cheapest?.fare ? (
        <p className="mt-1 text-sm text-blush/90">
          {t('tour.flights.from', { price: inr(cheapest.fare.amount), route: `${cheapest.from} → ${cheapest.to}` })}
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-white/10 text-xs sm:text-[13px]">
        {ROUTES.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="font-semibold text-paper">
                {r.from} → {r.to}
              </span>
              <span className="block text-[11px] text-blush/80">
                {r.airline}
                {r.flight ? ` ${r.flight}` : ''} · {r.frequency}
              </span>
            </span>
            <span className="shrink-0 text-right">
              {r.fare ? (
                <>
                  <span className="font-semibold text-gold">{inr(r.fare.amount)}*</span>
                  <span className="block text-[10px] text-blush/70">{t('tour.flights.return')}</span>
                </>
              ) : (
                <span className="text-[11px] text-blush/70">{t('tour.flights.checkFare')}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {UPCOMING.map((u) => (
        <p key={u.id} className="mt-2 text-[11px] text-blush/80">
          {t('tour.flights.upcoming', { route: `${u.from} → ${u.to}`, airline: u.airline, note: u.note })}
        </p>
      ))}
      <p className="mt-3 flex items-start gap-2 text-[10px] leading-snug text-blush/70">
        <StatusBadge status="needs-review" className="shrink-0" />
        <span>
          {t('tour.flights.footnote', { date: shortDate(FLIGHTS_CHECKED) })}{' '}
          {cheapest?.fare ? (
            <a href={cheapest.fare.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {t('tour.flights.fareSource')}
            </a>
          ) : null}
        </span>
      </p>
    </aside>
  );
}

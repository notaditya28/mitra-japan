import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { reasonText } from '../planner/confidenceText';
import { cityById, stopStatus } from '../planner/data';
import { VISA } from '../visa/visa';
import { usePrint } from './usePrint';

const STATUS_KEY = {
  verified: 'status.verified',
  sample: 'status.sample',
  'needs-review': 'status.needsReview',
} as const;

/**
 * Print-only rendering of a trip (A4). Hidden on screen; the app is hidden
 * when printing (see the print rules in styles/index.css).
 */
export function TripPrint() {
  const { t } = useTranslation();
  const doc = usePrint((s) => s.doc);
  const booking = usePrint((s) => s.booking);
  const done = usePrint((s) => s.done);

  useEffect(() => {
    if (!doc) return;
    window.addEventListener('afterprint', done, { once: true });
    // Let the browser lay the page out (and fonts settle) before opening the dialog.
    const id = window.setTimeout(() => {
      void document.fonts.ready.then(() => window.print());
    }, 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [doc, done]);

  if (!doc) return null;

  return createPortal(
    <article id="print-root" className="print-doc">
      <header className="print-header">
        <p className="print-brand">Mitra Japan · 旅</p>
        <h1>{doc.name}</h1>
        <p className="print-meta">
          {t('export.print.generated', { date: doc.generatedAt })} · {t('diets.label')}:{' '}
          {t(`diets.${doc.diet}`)} ·{' '}
          {doc.source === 'sample'
            ? t('trip.sampleBadge')
            : `${t('trip.liveBadge')}${doc.model ? ` (${doc.model})` : ''}`}
        </p>
        <p className="print-note">{t('export.print.demoNote')}</p>
      </header>

      <p>{doc.summary}</p>
      {doc.notices.length > 0 ? (
        <ul className="print-box">
          {doc.notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      {booking ? (
        <section className="print-box">
          <h2>{t('booking.print.title')}</h2>
          <p>
            {t('booking.print.body', {
              ref: booking.ref,
              date: booking.startDate,
              people: booking.adults + booking.children + booking.seniors,
              rooms: booking.rooms,
            })}
          </p>
          <p className="print-note">{t('booking.notReal')}</p>
        </section>
      ) : null}

      {doc.days.map(({ day, cityName, cityJa, confidence }) => {
        const from = day.transport.fromCityId ? cityById(day.transport.fromCityId) : undefined;
        return (
          <section key={day.day} className="print-day">
            <h2>
              {t('trip.day', { n: day.day })} · {cityName} <span lang="ja">{cityJa}</span>
            </h2>
            <p className="print-title">{day.title}</p>
            <p className="print-meta">
              {t(`trip.modes.${day.transport.mode}`)}
              {from ? ` · ${t('trip.from', { city: from.name })}` : ''}
              {day.transport.estimatedHours !== null && day.transport.distanceKm !== null
                ? ` · ${t('trip.estimate', { h: day.transport.estimatedHours, km: day.transport.distanceKm })} (${t('status.estimate')})`
                : ''}
              {` · ${t('trip.stay')}: ${t(`trip.stayTypes.${day.stay.type}`)}${day.stay.area ? `, ${day.stay.area}` : ''}`}
            </p>
            <ol>
              {day.stops.map((s, i) => (
                <li key={`${s.name}-${i}`}>
                  <strong>{s.name}</strong>{' '}
                  <span className="print-tag">
                    {s.inOurData ? t(STATUS_KEY[stopStatus(s)]) : t('trip.suggestion')}
                  </span>
                  {s.note ? <span className="print-sub">{s.note}</span> : null}
                </li>
              ))}
            </ol>
            <div className="print-food">
              <p>
                <strong>
                  {t('confidence.title')}: {confidence.score}/100 ·{' '}
                  {t(`confidence.levels.${confidence.level}`)}
                </strong>
              </p>
              <ul>
                {confidence.reasons.map((r) => (
                  <li key={r.key}>{reasonText(r, t)}</li>
                ))}
              </ul>
              {day.foodNotes ? <p>{day.foodNotes}</p> : null}
            </div>
            {day.flags.length > 0 ? (
              <p className="print-meta">
                {t('trip.warnings')}: {day.flags.map((f) => f.message).join(' ')}
              </p>
            ) : null}
            {day.tips.length > 0 ? (
              <p className="print-meta">
                {t('trip.tips')}: {day.tips.join(' · ')}
              </p>
            ) : null}
          </section>
        );
      })}

      <section className="print-day">
        <h2>{t('export.print.practical')}</h2>
        {doc.bestSeason ? (
          <p>
            <strong>{t('trip.seasonTitle')}:</strong> {doc.bestSeason}
          </p>
        ) : null}
        {doc.etiquetteTips.length > 0 ? (
          <>
            <p>
              <strong>{t('trip.etiquetteTitle')}</strong>
            </p>
            <ul>
              {doc.etiquetteTips.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </>
        ) : null}
        {doc.visaChecklist.length > 0 ? (
          <>
            <p>
              <strong>{t('trip.visaTitle')}</strong> ({t('status.needsReview')})
            </p>
            <ul>
              {doc.visaChecklist.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <p className="print-note">{t('trip.visaNote')}</p>
            <ul>
              {VISA.links.map((l) => (
                <li key={l.id}>
                  {l.label}: {l.url}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="print-day">
        <h2>{t('export.print.sources')}</h2>
        <table>
          <thead>
            <tr>
              <th>{t('export.print.col.source')}</th>
              <th>{t('export.print.col.status')}</th>
              <th>{t('export.print.col.checked')}</th>
              <th>{t('export.print.col.link')}</th>
            </tr>
          </thead>
          <tbody>
            {doc.sources.map((s) => (
              <tr key={`${s.kind}:${s.label}`}>
                <td>
                  {t(`export.print.kinds.${s.kind}`)}: {s.label}
                  {s.source ? <span className="print-sub">{s.source}</span> : null}
                </td>
                <td>{t(STATUS_KEY[s.status])}</td>
                <td>{s.lastChecked ?? t('export.print.notChecked')}</td>
                <td className="print-url">{s.url ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="print-note">
          <li>{t('export.print.disclaimers.times')}</li>
          <li>{t('export.print.disclaimers.food')}</li>
          <li>{t('export.print.disclaimers.visa')}</li>
        </ul>
      </section>
    </article>,
    document.body,
  );
}

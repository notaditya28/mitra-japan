import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useSchedulePrint } from './schedule';

/**
 * Print-only Schedule of Stay draft (A4, landscape-friendly table). Plain Mitra
 * Japan layout with a "not an official form" line on every page; blanks print as
 * lines to fill by hand.
 */
export function SchedulePrint() {
  const { t } = useTranslation();
  const doc = useSchedulePrint((s) => s.doc);
  const done = useSchedulePrint((s) => s.done);

  useEffect(() => {
    if (!doc) return;
    window.addEventListener('afterprint', done, { once: true });
    const id = window.setTimeout(() => {
      void document.fonts.ready.then(() => window.print());
    }, 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [doc, done]);

  if (!doc) return null;
  const blank = '____________';

  return createPortal(
    <article id="print-root" className="print-doc">
      <header className="print-header">
        <p className="print-brand">Mitra Japan · 旅</p>
        <h1>{t('schedule.printTitle')}</h1>
        <p className="print-meta">
          {doc.applicant ? `${t('schedule.applicant')}: ${doc.applicant} · ` : ''}
          {t('export.print.generated', { date: doc.generatedAt })}
        </p>
        <p className="print-note">{t('schedule.notOfficial')}</p>
      </header>
      <table className="print-table">
        <thead>
          <tr>
            <th>{t('schedule.date')}</th>
            <th>{t('schedule.activities')}</th>
            <th>{t('schedule.hotel')}</th>
            <th>{t('schedule.address')}</th>
            <th>{t('schedule.phone')}</th>
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((r) => (
            <tr key={r.day}>
              <td>
                {r.date ?? blank}
                <br />
                <span className="print-sub">{r.city}</span>
              </td>
              <td>{r.activities || blank}</td>
              <td>{r.hotel || blank}</td>
              <td>{r.address || blank}</td>
              <td>{r.phone || blank}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="print-note">{t('schedule.printFooter')}</p>
    </article>,
    document.body,
  );
}

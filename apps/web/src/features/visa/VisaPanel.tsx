import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore, type VisaPurpose, type VisaTraveller } from '../../store/useAppStore';
import { VISA, itemsFor, linkById } from './visa';

function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  label,
}: {
  legend: string;
  name: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-plum">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-rose ${
              value === o
                ? 'border-plum bg-plum text-paper'
                : 'border-petal bg-blush text-plum hover:border-rose'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o}
              checked={value === o}
              onChange={() => onChange(o)}
              className="sr-only"
            />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Visa preparation checklist: two questions (purpose, traveller type), then
 * a list to tick off. Preparation help only; every item links to an
 * official source to confirm.
 */
export default function VisaPanel() {
  const { t } = useTranslation();
  const id = useId();
  const visa = useAppStore((s) => s.visa);
  const setProfile = useAppStore((s) => s.setVisaProfile);
  const toggle = useAppStore((s) => s.toggleVisaItem);
  const items = itemsFor(visa.purpose, visa.traveller);
  const done = items.filter((i) => visa.done.includes(i.id)).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-gold/20 px-4 py-3 text-sm text-plum">
        <p className="font-semibold">{t('visaTool.disclaimer')}</p>
        <p className="mt-1 text-xs">
          <StatusBadge status={VISA.status} className="mr-2 align-middle" />
          {VISA.lastReviewed
            ? t('visaTool.lastReviewed', { date: VISA.lastReviewed })
            : t('visaTool.notReviewed', { date: VISA.researched })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Choice<VisaPurpose>
          legend={t('visaTool.purpose')}
          name={`${id}-purpose`}
          options={VISA.purposes}
          value={visa.purpose}
          onChange={(purpose) => setProfile({ purpose })}
          label={(p) => t(`visaTool.purposes.${p}`)}
        />
        <Choice<VisaTraveller>
          legend={t('visaTool.traveller')}
          name={`${id}-traveller`}
          options={VISA.travellers}
          value={visa.traveller}
          onChange={(traveller) => setProfile({ traveller })}
          label={(v) => t(`visaTool.travellers.${v}`)}
        />
      </div>

      <section aria-labelledby={`${id}-list`}>
        <div className="flex items-center justify-between gap-3">
          <h3 id={`${id}-list`} className="font-display text-xl text-plum">
            {t('visaTool.listTitle')}
          </h3>
          <p className="text-xs font-semibold text-mist" aria-live="polite">
            {t('visaTool.progress', { done, total: items.length })}
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          {items.map((i) => {
            const link = linkById(i.link);
            const checked = visa.done.includes(i.id);
            return (
              <li key={i.id} className="rounded-2xl border border-blush bg-white/80 p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(i.id)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-rose"
                  />
                  <span className={`text-sm ${checked ? 'text-mist line-through' : 'text-ink'}`}>
                    {i.text}
                  </span>
                </label>
                <p className="mt-1 pl-8 text-xs text-mist">
                  {t('visaTool.confirm')}
                  {link ? (
                    <>
                      {': '}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-rose underline-offset-4 hover:underline"
                      >
                        {link.label}
                        <span className="sr-only"> ({t('restaurants.newTab')})</span>
                      </a>
                    </>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby={`${id}-links`} className="rounded-2xl bg-blush/60 p-4">
        <h3 id={`${id}-links`} className="text-sm font-semibold text-plum">
          {t('visaTool.officialTitle')}
        </h3>
        <ul className="mt-2 space-y-1 text-sm">
          {VISA.links.map((l) => (
            <li key={l.id}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-rose underline-offset-4 hover:underline"
              >
                {l.label}
                <span className="sr-only"> ({t('restaurants.newTab')})</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-mist">{t('visaTool.storage')}</p>
      </section>
    </div>
  );
}

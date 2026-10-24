import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GuideBadge } from '../../components/GuideBadge';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore, type VisaPurpose, type VisaTraveller } from '../../store/useAppStore';
import { usePlannerStore } from '../planner/usePlannerStore';
import { useTools } from '../tools/useTools';
import {
  STATES,
  VISA,
  groupItems,
  itemsFor,
  linkById,
  officeForState,
  type VisaSource,
} from './visa';

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

type Tab = 'checklist' | 'types' | 'where' | 'money';
const TABS: Tab[] = ['checklist', 'types', 'where', 'money'];

function SourceLine({ source }: { source: VisaSource }) {
  const { t } = useTranslation();
  return source === 'team-guide' ? (
    <GuideBadge />
  ) : (
    <span className="text-[10px] font-bold uppercase tracking-wide text-mist">
      {t('visaTool.officialSummary')}
    </span>
  );
}

function OfficialLink({ id }: { id: string | null }) {
  const { t } = useTranslation();
  const link = linkById(id);
  return (
    <>
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
    </>
  );
}

function Checklist({ id }: { id: string }) {
  const { t } = useTranslation();
  const visa = useAppStore((s) => s.visa);
  const setProfile = useAppStore((s) => s.setVisaProfile);
  const toggle = useAppStore((s) => s.toggleVisaItem);
  const openTool = useTools((s) => s.open);
  const hasPlan = usePlannerStore((s) => s.itinerary !== null);
  const items = itemsFor(visa.purpose, visa.traveller);
  const done = items.filter((i) => visa.done.includes(i.id)).length;

  return (
    <div className="flex flex-col gap-5">
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
        {groupItems(items).map((g) => (
          <div key={g.id} className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wide text-plum">
              {t(`visaTool.categories.${g.id}`, { defaultValue: g.label })}
            </h4>
            <ul className="mt-2 space-y-2">
              {g.items.map((i) => {
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
                      <span
                        className={`text-sm ${checked ? 'text-mist line-through' : 'text-ink'}`}
                      >
                        {i.text}
                      </span>
                    </label>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-8 text-xs text-mist">
                      <SourceLine source={i.source} />
                      <span>
                        <OfficialLink id={i.link} />
                      </span>
                    </div>
                    {i.action === 'schedule' ? (
                      <div className="mt-2 pl-8">
                        <button
                          type="button"
                          onClick={() => openTool('schedule')}
                          disabled={!hasPlan}
                          className="rounded-full border border-petal bg-blush px-3 py-1 text-xs font-semibold text-plum transition hover:border-rose disabled:opacity-50"
                        >
                          {t('visaTool.makeSchedule')}
                        </button>
                        {hasPlan ? null : (
                          <span className="ml-2 text-xs text-mist">{t('visaTool.needPlan')}</span>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function Types() {
  const { t } = useTranslation();
  const { columns, rows, source } = VISA.types;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-xl text-plum">{t('visaTool.typesTitle')}</h3>
        <SourceLine source={source} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-blush">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">{t('visaTool.typesTitle')}</caption>
          <thead className="bg-blush/70 text-xs text-plum">
            <tr>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">{t('visaTool.feature')}</span>
              </th>
              {columns.map((c) => (
                <th key={c.id} scope="col" className="px-3 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-blush align-top">
                <th scope="row" className="px-3 py-2 text-xs font-semibold text-plum">
                  {r.label}
                </th>
                {columns.map((c) => (
                  <td key={c.id} className="px-3 py-2 text-ink">
                    {r[c.id]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-mist">
        <OfficialLink id="mofa-evisa" />
      </p>
    </section>
  );
}

function Where({ id }: { id: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState('');
  const office = state ? officeForState(state) : undefined;
  const { offices, note, source } = VISA.jurisdictions;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-xl text-plum">{t('visaTool.whereTitle')}</h3>
        <SourceLine source={source} />
      </div>
      <p className="text-sm text-ink">{note}</p>
      <div>
        <label htmlFor={`${id}-state`} className="text-xs font-semibold text-plum">
          {t('visaTool.stateLabel')}
        </label>
        <select
          id={`${id}-state`}
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="mt-1 block w-full rounded-xl border border-petal bg-white px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none focus:ring-2 focus:ring-rose/30 sm:max-w-sm"
        >
          <option value="">{t('visaTool.statePlaceholder')}</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div aria-live="polite">
        {state && office ? (
          <div className="rounded-2xl border border-blush bg-white/80 p-4 text-sm">
            <p className="font-semibold text-plum">{office.name}</p>
            <p className="mt-1 text-ink">
              {t('visaTool.centres', { list: office.centres.join(', ') })}
            </p>
          </div>
        ) : state ? (
          <p className="rounded-2xl bg-gold/20 p-4 text-sm text-plum">{t('visaTool.unlisted')}</p>
        ) : null}
      </div>
      <details className="rounded-2xl border border-blush bg-white/60 p-3 text-sm">
        <summary className="cursor-pointer font-semibold text-plum">
          {t('visaTool.allOffices')}
        </summary>
        <ul className="mt-2 space-y-2">
          {offices.map((o) => (
            <li key={o.id}>
              <p className="font-semibold text-plum">{o.name}</p>
              <p className="text-xs text-ink">{o.states.join(', ')}</p>
              <p className="text-xs text-mist">
                {t('visaTool.centres', { list: o.centres.join(', ') })}
              </p>
            </li>
          ))}
        </ul>
      </details>
      <p className="text-xs text-mist">
        <OfficialLink id="embassy" />
      </p>
    </section>
  );
}

function Money() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-xl text-plum">{t('visaTool.moneyTitle')}</h3>
          <SourceLine source={VISA.finance.source} />
        </div>
        <dl className="space-y-2">
          {VISA.finance.items.map((f) => (
            <div key={f.id} className="rounded-2xl border border-blush bg-white/80 p-3 text-sm">
              <dt className="font-semibold text-plum">{f.label}</dt>
              <dd className="text-ink">{f.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-xl text-plum">{t('visaTool.pitfallsTitle')}</h3>
          <SourceLine source={VISA.pitfalls.source} />
        </div>
        <ol className="space-y-2">
          {VISA.pitfalls.items.map((p, i) => (
            <li key={p.id} className="rounded-2xl border border-blush bg-white/80 p-3 text-sm">
              <p className="font-semibold text-plum">
                {i + 1}. {p.title}
              </p>
              <p className="text-ink">{p.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-xs text-mist">
        <OfficialLink id="embassy" />
      </p>
    </div>
  );
}

/**
 * Visa readiness checker for Indian passport holders: a checklist built from two
 * questions (purpose, traveller type), the eVISA vs sticker comparison, where to
 * apply by state, and money tips. Preparation help only; the team guide's figures
 * are labelled as such and every section points to the official source to confirm.
 */
export default function VisaPanel() {
  const { t } = useTranslation();
  const id = useId();
  const [tab, setTab] = useState<Tab>('checklist');

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
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <GuideBadge />
          {t('visaTool.guideExplain')}
        </p>
      </div>

      <div
        role="tablist"
        aria-label={t('visaTool.sections')}
        className="flex flex-wrap gap-1 rounded-3xl bg-blush p-1"
      >
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`${id}-tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`${id}-panel`}
            onClick={() => setTab(k)}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              tab === k ? 'bg-paper text-plum shadow-soft' : 'text-mist hover:text-plum'
            }`}
          >
            {t(`visaTool.tabs.${k}`)}
          </button>
        ))}
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'checklist' ? <Checklist id={id} /> : null}
        {tab === 'types' ? <Types /> : null}
        {tab === 'where' ? <Where id={id} /> : null}
        {tab === 'money' ? <Money /> : null}
      </div>

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
        <p className="mt-3 text-xs text-mist">{VISA.guideNote}</p>
        <p className="mt-1 text-xs text-mist">{t('visaTool.storage')}</p>
      </section>
    </div>
  );
}

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { DietChips } from '../../components/DietChips';
import { useAppStore, type Diet, type Persona } from '../../store/useAppStore';
import { PACES, type Pace } from './itinerary';
import {
  BUDGETS,
  INTERESTS,
  MAX_DAYS,
  MIN_DAYS,
  START_CITIES,
  useTripPrefs,
  type Budget,
  type StartCity,
} from './tripPrefs';

const PERSONAS: (Persona | 'custom')[] = [
  'family',
  'honeymoon',
  'student',
  'foodie',
  'spiritual',
  'custom',
];
const GROUP_DIETS: Diet[] = ['jain', 'vegetarian', 'vegan', 'halal', 'no-beef', 'eggless'];

const chip = (on: boolean) =>
  `cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-rose ${
    on ? 'border-plum bg-plum text-paper' : 'border-petal bg-blush text-plum hover:border-rose'
  }`;

function Radio<T extends string>({
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
          <label key={o} className={chip(value === o)}>
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
 * The team guide's structured trip inputs, next to the free-text prompt: persona,
 * duration (2-12 days), starting city, travellers, pace, budget, diets and interests.
 */
export function TripOptions() {
  const { t } = useTranslation();
  const id = useId();
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);
  const diet = useAppStore((s) => s.diet);
  const prefs = useTripPrefs((s) => s.prefs);
  const set = useTripPrefs((s) => s.set);
  const toggleInterest = useTripPrefs((s) => s.toggleInterest);
  const toggleDiet = useTripPrefs((s) => s.toggleDiet);

  return (
    <details
      id="trip-options"
      className="scroll-mt-2 rounded-2xl border border-blush bg-white/70 p-3"
      open
    >
      <summary className="cursor-pointer text-sm font-semibold text-plum">
        {t('tripOptions.title')}
        <span className="ml-2 text-xs font-normal text-mist">
          {t('tripOptions.summary', {
            days: prefs.days,
            city: t(`tripOptions.cities.${prefs.startCity}`),
            n: prefs.travellers,
          })}
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <Radio<Persona | 'custom'>
          legend={t('tripOptions.persona')}
          name={`${id}-persona`}
          options={PERSONAS}
          value={persona ?? 'custom'}
          onChange={(p) => setPersona(p === 'custom' ? null : p)}
          label={(p) =>
            p === 'custom' ? t('tripOptions.customPersona') : t(`persona.options.${p}.label`)
          }
        />

        <div>
          <label
            htmlFor={`${id}-days`}
            className="flex items-center justify-between text-xs font-semibold text-plum"
          >
            {t('tripOptions.days')}
            <output htmlFor={`${id}-days`} className="rounded-full bg-blush px-2 py-0.5 text-plum">
              {t('tripOptions.daysValue', { count: prefs.days })}
            </output>
          </label>
          <input
            id={`${id}-days`}
            type="range"
            min={MIN_DAYS}
            max={MAX_DAYS}
            step={1}
            value={prefs.days}
            onChange={(e) => set({ days: Number(e.target.value) })}
            className="mt-1 w-full accent-rose"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Radio<StartCity>
            legend={t('tripOptions.startCity')}
            name={`${id}-start`}
            options={START_CITIES}
            value={prefs.startCity}
            onChange={(startCity) => set({ startCity })}
            label={(c) => t(`tripOptions.cities.${c}`)}
          />
          <div>
            <label htmlFor={`${id}-people`} className="text-xs font-semibold text-plum">
              {t('tripOptions.travellers')}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => set({ travellers: prefs.travellers - 1 })}
                disabled={prefs.travellers <= 1}
                aria-label={t('tripOptions.fewer')}
                className="grid h-8 w-8 place-items-center rounded-full bg-blush text-plum disabled:opacity-40"
              >
                −
              </button>
              <input
                id={`${id}-people`}
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                value={prefs.travellers}
                onChange={(e) => set({ travellers: Number(e.target.value) })}
                className="w-16 rounded-xl border border-petal bg-white px-2 py-1 text-center text-sm text-ink focus:border-rose focus:outline-none focus:ring-2 focus:ring-rose/30"
              />
              <button
                type="button"
                onClick={() => set({ travellers: prefs.travellers + 1 })}
                disabled={prefs.travellers >= 12}
                aria-label={t('tripOptions.more')}
                className="grid h-8 w-8 place-items-center rounded-full bg-blush text-plum disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Radio<Pace | 'auto'>
            legend={t('tripOptions.pace')}
            name={`${id}-pace`}
            options={['auto', ...PACES]}
            value={prefs.pace ?? 'auto'}
            onChange={(p) => set({ pace: p === 'auto' ? null : p })}
            label={(p) => t(`tripOptions.paces.${p}`)}
          />
          <Radio<Budget>
            legend={t('tripOptions.budget')}
            name={`${id}-budget`}
            options={BUDGETS}
            value={prefs.budget}
            onChange={(budget) => set({ budget })}
            label={(b) => t(`tripOptions.budgets.${b}`)}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-plum">{t('tripOptions.yourDiet')}</p>
          <div className="mt-1">
            <DietChips />
          </div>
          <fieldset className="mt-2">
            <legend className="text-xs text-mist">{t('tripOptions.groupDiets')}</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {GROUP_DIETS.filter((d) => d !== diet).map((d) => (
                <label key={d} className={chip(prefs.diets.includes(d))}>
                  <input
                    type="checkbox"
                    checked={prefs.diets.includes(d)}
                    onChange={() => toggleDiet(d)}
                    className="sr-only"
                  />
                  {t(`diets.${d}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <fieldset>
          <legend className="text-xs font-semibold text-plum">{t('tripOptions.interests')}</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {INTERESTS.map((i) => (
              <label key={i} className={chip(prefs.interests.includes(i))}>
                <input
                  type="checkbox"
                  checked={prefs.interests.includes(i)}
                  onChange={() => toggleInterest(i)}
                  className="sr-only"
                />
                {t(`tripOptions.interestNames.${i}`)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </details>
  );
}

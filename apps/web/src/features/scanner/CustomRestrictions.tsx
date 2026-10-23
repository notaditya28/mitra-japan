import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

const JAPANESE = /[぀-ヿ㐀-鿿]/;

const SUGGESTIONS = [
  { term: 'きのこ', label: 'Mushrooms' },
  { term: 'ごま', label: 'Sesame' },
  { term: 'そば', label: 'Buckwheat (soba)' },
  { term: '落花生', label: 'Peanuts' },
];

/** The traveller's own extra restrictions, matched as exact Japanese words. */
export function CustomRestrictions() {
  const { t } = useTranslation();
  const id = useId();
  const custom = useAppStore((s) => s.customRestrictions);
  const add = useAppStore((s) => s.addRestriction);
  const remove = useAppStore((s) => s.removeRestriction);
  const [term, setTerm] = useState('');
  const [label, setLabel] = useState('');
  const [errors, setErrors] = useState<{ term?: string; label?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const tr = term.trim();
    if (!tr) next.term = t('scanner.custom.errorTermEmpty');
    else if (!JAPANESE.test(tr) || tr.length > 20) next.term = t('scanner.custom.errorTermJa');
    if (!label.trim()) next.label = t('scanner.custom.errorLabel');
    else if (label.trim().length > 40) next.label = t('scanner.custom.errorLabelLong');
    if (custom.length >= 10) next.term = t('scanner.custom.errorMax');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    add({ term: tr, label: label.trim() });
    setTerm('');
    setLabel('');
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-2xl border border-blush bg-white/70 p-4"
    >
      <h3 id={`${id}-title`} className="text-sm font-semibold text-plum">
        {t('scanner.custom.title')}
      </h3>
      <p className="mt-1 text-xs text-mist">{t('scanner.custom.hint')}</p>

      {custom.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('scanner.custom.list')}>
          {custom.map((c) => (
            <li key={c.term} className="chip !py-0.5 !text-xs">
              <span lang="ja">{c.term}</span>
              <span className="text-mist">· {c.label}</span>
              <button
                type="button"
                onClick={() => remove(c.term)}
                aria-label={t('scanner.custom.remove', { label: c.label })}
                className="ml-1 grid h-5 w-5 place-items-center rounded-full text-plum hover:bg-petal"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        onSubmit={submit}
        noValidate
        className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
      >
        <div>
          <label htmlFor={`${id}-term`} className="text-xs font-semibold text-plum">
            {t('scanner.custom.term')}
          </label>
          <input
            id={`${id}-term`}
            lang="ja"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="きのこ"
            aria-invalid={errors.term ? true : undefined}
            aria-describedby={errors.term ? `${id}-term-error` : undefined}
            className="mt-1 w-full rounded-xl border border-petal bg-paper px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/40"
          />
          {errors.term ? (
            <p id={`${id}-term-error`} className="mt-1 text-xs font-semibold text-torii">
              {errors.term}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor={`${id}-label`} className="text-xs font-semibold text-plum">
            {t('scanner.custom.label')}
          </label>
          <input
            id={`${id}-label`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('scanner.custom.labelPlaceholder')}
            aria-invalid={errors.label ? true : undefined}
            aria-describedby={errors.label ? `${id}-label-error` : undefined}
            className="mt-1 w-full rounded-xl border border-petal bg-paper px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none focus-visible:ring-2 focus-visible:ring-rose/40"
          />
          {errors.label ? (
            <p id={`${id}-label-error`} className="mt-1 text-xs font-semibold text-torii">
              {errors.label}
            </p>
          ) : null}
        </div>
        <button type="submit" className="btn-primary !px-5 !py-2 text-sm sm:mt-5">
          {t('scanner.custom.add')}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-mist">{t('scanner.custom.examples')}:</span>
        {SUGGESTIONS.filter((s) => !custom.some((c) => c.term === s.term)).map((s) => (
          <button
            key={s.term}
            type="button"
            onClick={() => add(s)}
            className="rounded-full border border-petal px-2 py-0.5 text-plum hover:border-rose"
          >
            <span lang="ja">{s.term}</span> · {s.label}
          </button>
        ))}
      </div>
    </section>
  );
}

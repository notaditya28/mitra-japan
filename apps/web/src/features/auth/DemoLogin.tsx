import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DietChips } from '../../components/DietChips';
import { Fuji } from '../../components/motifs/Fuji';
import { Seigaiha } from '../../components/motifs/Seigaiha';
import { playPortal } from '../../lib/portal';
import { navigate } from '../../lib/router';
import { useAppStore } from '../../store/useAppStore';
import { PERSONAS } from '../persona/personas';
import { PersonaIcon } from '../persona/PersonaIcon';
import { formatPhone, normalizePhone, validateDemoUser, type FieldError } from './demoAuth';

/**
 * Demo sign-in (owner decision 2026-10-23): name + mobile, stored only in this
 * browser. No account, no OTP, no network request.
 */
export function DemoLogin() {
  const { t } = useTranslation();
  const user = useAppStore((s) => s.user);
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);
  const signIn = useAppStore((s) => s.signIn);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user ? formatPhone(user.phone) : '');
  const [errors, setErrors] = useState<Partial<Record<'name' | 'phone', FieldError>>>({});
  const ids = { name: useId(), phone: useId(), nameErr: useId(), phoneErr: useId(), note: useId() };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateDemoUser(name, phone);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    signIn({ name: name.trim(), phone: normalizePhone(phone) });
    playPortal(() => navigate('plan'));
  };

  return (
    <main
      id="main"
      className="relative isolate min-h-[100svh] overflow-hidden bg-plum px-4 pb-40 pt-28 sm:px-8"
    >
      <Seigaiha bg="#4A2238" line="#FFF8FA" lineOpacity={0.05} className="absolute inset-0 -z-20" />
      <Fuji className="absolute inset-x-0 bottom-0 -z-10 h-[34vh] w-full" />
      <div className="mx-auto max-w-xl">
        <form onSubmit={submit} noValidate aria-describedby={ids.note} className="card p-6 sm:p-9">
          <p className="eyebrow text-rose">{t('login.eyebrow')}</p>
          <h1 className="display mt-3 text-4xl text-plum sm:text-5xl">{t('login.title')}</h1>
          <p className="mt-3 text-mist">{t('login.body')}</p>

          <div className="mt-7 grid gap-5">
            <div>
              <label htmlFor={ids.name} className="mb-1.5 block text-sm font-semibold text-plum">
                {t('login.name')}
              </label>
              <input
                id={ids.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder={t('login.namePh')}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? ids.nameErr : undefined}
                className="w-full rounded-xl border border-petal bg-paper px-4 py-3 text-ink outline-none transition focus:border-rose focus:ring-2 focus:ring-rose/30"
              />
              {errors.name ? (
                <p id={ids.nameErr} className="mt-1.5 text-sm text-torii">
                  {t(`login.errors.${errors.name}`)}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor={ids.phone} className="mb-1.5 block text-sm font-semibold text-plum">
                {t('login.phone')}{' '}
                <span className="font-normal text-mist">· {t('login.phoneHint')}</span>
              </label>
              <div className="flex rounded-xl border border-petal bg-paper transition focus-within:border-rose focus-within:ring-2 focus-within:ring-rose/30">
                <span className="grid place-items-center border-r border-petal px-3 text-sm font-semibold text-mist">
                  +91
                </span>
                <input
                  id={ids.phone}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? ids.phoneErr : undefined}
                  className="w-full rounded-r-xl bg-transparent px-4 py-3 text-ink outline-none"
                />
              </div>
              {errors.phone ? (
                <p id={ids.phoneErr} className="mt-1.5 text-sm text-torii">
                  {t(`login.errors.${errors.phone}`)}
                </p>
              ) : null}
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-plum">{t('login.persona')}</legend>
              <div className="flex flex-wrap gap-2">
                {PERSONAS.map((p) => {
                  const on = persona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPersona(p.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                        on
                          ? 'border-plum bg-plum text-paper'
                          : 'border-petal bg-blush text-plum hover:border-rose'
                      }`}
                    >
                      <PersonaIcon id={p.id} className="h-4 w-4" />
                      {t(`persona.options.${p.id}.label`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-plum">{t('login.diet')}</legend>
              <DietChips
                diets={['jain', 'vegetarian', 'vegan', 'halal', 'no-beef', 'eggless', 'none']}
              />
            </fieldset>
          </div>

          <button type="submit" className="btn-primary mt-8 w-full">
            {t('login.submit')}
          </button>
          <p id={ids.note} className="mt-4 rounded-xl bg-blush/70 px-4 py-3 text-xs text-plum">
            {t('login.note')}
          </p>
          <button
            type="button"
            onClick={() => playPortal(() => navigate('journey'))}
            className="mt-5 text-sm font-semibold text-rose underline-offset-4 hover:underline"
          >
            ← {t('login.back')}
          </button>
        </form>
      </div>
    </main>
  );
}

import { useTranslation } from 'react-i18next';
import { JapanMapSvg } from '../../components/JapanMapSvg';
import { Seigaiha } from '../../components/motifs/Seigaiha';
import { playPortal } from '../../lib/portal';
import { navigate } from '../../lib/router';
import { useAppStore } from '../../store/useAppStore';
import { formatPhone } from '../auth/demoAuth';
import { PersonaIcon } from '../persona/PersonaIcon';

/**
 * Planner landing after demo sign-in. Milestone 4 replaces the flat map with
 * the 3D map and layers; milestone 5 adds the AI guide and itinerary.
 */
export function PlannerHome() {
  const { t } = useTranslation();
  const user = useAppStore((s) => s.user);
  const persona = useAppStore((s) => s.persona);
  const diet = useAppStore((s) => s.diet);
  const signOut = useAppStore((s) => s.signOut);
  const next = t('planner.next', { returnObjects: true }) as string[];
  if (!user) return null;

  return (
    <main id="main" className="relative isolate min-h-[100svh] px-4 pb-20 pt-28 sm:px-8">
      <Seigaiha className="absolute inset-0 -z-10" lineOpacity={0.05} />
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="planner-hello" className="flex flex-col gap-6">
          <div>
            <p className="eyebrow text-rose">{t('planner.demo')}</p>
            <h1 id="planner-hello" className="display mt-3 text-5xl text-plum sm:text-6xl">
              {t('planner.greeting', { name: user.name.split(' ')[0] })}
            </h1>
            <p className="mt-3 text-lg text-mist">{t('planner.subtitle')}</p>
            <p className="mt-1 text-sm text-mist">{formatPhone(user.phone)}</p>
          </div>

          <div className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-mist">
                {t('planner.travelling')}
              </p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-plum">
                {persona ? <PersonaIcon id={persona} className="h-5 w-5 text-rose" /> : null}
                {persona ? t(`persona.options.${persona}.label`) : t('planner.notChosen')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-mist">
                {t('planner.eating')}
              </p>
              <p className="mt-1 font-semibold text-plum">{t(`diets.${diet}`)}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('login')}
              className="ml-auto text-sm font-semibold text-rose underline-offset-4 hover:underline"
            >
              {t('planner.edit')}
            </button>
          </div>

          <div className="card-dark p-6">
            <p className="eyebrow text-gold">{t('planner.nextTitle')}</p>
            <ol className="mt-4 space-y-3">
              {next.map((item, i) => (
                <li key={item} className="flex gap-3 text-sm text-blush">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/25 text-xs font-bold text-gold">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => playPortal(() => navigate('journey'))}
              className="btn-ghost text-plum"
            >
              ← {t('login.back')}
            </button>
            <button
              type="button"
              onClick={() => {
                signOut();
                navigate('journey');
              }}
              className="btn-ghost text-mist"
            >
              {t('planner.signOut')}
            </button>
          </div>
        </section>

        <section aria-labelledby="planner-map" className="card p-4 sm:p-6">
          <h2 id="planner-map" className="font-display text-2xl text-plum">
            {t('planner.mapTitle')}
          </h2>
          <p className="mt-1 text-sm text-mist">{t('planner.mapNote')}</p>
          <JapanMapSvg
            title={t('planner.mapTitle')}
            className="mx-auto mt-4 h-auto max-h-[70vh] w-full"
          />
        </section>
      </div>
    </main>
  );
}

import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../components/BottomSheet';
import { JapanMapSvg } from '../../components/JapanMapSvg';
import { SceneErrorBoundary } from '../../components/SceneErrorBoundary';
import { getDeviceProfile } from '../../lib/device';
import { navigate } from '../../lib/router';
import { useAppStore } from '../../store/useAppStore';
import { PersonaIcon } from '../persona/PersonaIcon';
import { CityCard } from './CityCard';
import { CityList } from './CityList';
import { cityById } from './data';
import { GuidePanel } from './GuidePanel';
import { ItineraryPanel } from './ItineraryPanel';
import { LayerToggles } from './LayerToggles';
import { usePlannerStore, visibleDays } from './usePlannerStore';
import { ToolDialogs } from '../tools/ToolDialogs';
import { ToolLauncher } from '../tools/ToolLauncher';
import { TripPrint } from '../export/TripPrint';

const MapCanvas = lazy(() => import('./map/MapCanvas'));

function useIsDesktop(): boolean {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatch(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return match;
}

function MapFallback({ title }: { title: string }) {
  return (
    <div className="grid h-full w-full place-items-center bg-plum p-6">
      <JapanMapSvg title={title} className="h-full max-h-[80vh] w-auto" />
    </div>
  );
}

/** Left panel: who is travelling, the AI guide, map layers, and the sample route preview. */
function TripPanel() {
  const { t } = useTranslation();
  const user = useAppStore((s) => s.user);
  const persona = useAppStore((s) => s.persona);
  const diet = useAppStore((s) => s.diet);
  const showSampleRoute = useAppStore((s) => s.showSampleRoute);
  const setShowSampleRoute = useAppStore((s) => s.setShowSampleRoute);
  const signOut = useAppStore((s) => s.signOut);
  const hasPlan = usePlannerStore((s) => s.itinerary !== null || s.previews.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow text-rose">{t('planner.demo')}</p>
        <h1 className="display mt-2 text-3xl text-plum">
          {t('planner.greeting', { name: user?.name.split(' ')[0] ?? '' })}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="chip">
            {persona ? <PersonaIcon id={persona} className="h-4 w-4" /> : null}
            {persona ? t(`persona.options.${persona}.label`) : t('planner.notChosen')}
          </span>
          <span className="chip">{t(`diets.${diet}`)}</span>
          <button
            type="button"
            onClick={() => navigate('login')}
            className="text-sm font-semibold text-rose underline-offset-4 hover:underline"
          >
            {t('planner.edit')}
          </button>
        </div>
      </div>

      <GuidePanel />

      <ToolLauncher />

      <LayerToggles />

      {hasPlan ? null : (
        <div className="card-dark p-5">
          <p className="eyebrow text-gold">{t('planner.routeTitle')}</p>
          <p className="mt-2 text-sm text-blush">{t('planner.routeBody')}</p>
          <button
            type="button"
            aria-pressed={showSampleRoute}
            onClick={() => setShowSampleRoute(!showSampleRoute)}
            className="btn-primary mt-4 w-full !py-2.5 text-sm"
          >
            {showSampleRoute ? t('planner.hideSample') : t('planner.showSample')}
          </button>
          {showSampleRoute ? (
            <p className="mt-2 text-xs text-blush/80">{t('planner.sampleNote')}</p>
          ) : null}
        </div>
      )}

      <div className="space-y-2 text-xs text-mist">
        <p>{t('footer.demo')}</p>
        <button
          type="button"
          onClick={() => {
            signOut();
            navigate('journey');
          }}
          className="font-semibold text-rose underline-offset-4 hover:underline"
        >
          {t('planner.signOut')}
        </button>
      </div>
    </div>
  );
}

type Tab = 'itinerary' | 'city';

/** Right panel (or sheet body): the itinerary, or details for the selected city. */
function RightPanel() {
  const { t } = useTranslation();
  const selectedCityId = useAppStore((s) => s.selectedCityId);
  const selectCity = useAppStore((s) => s.selectCity);
  const selectedDay = usePlannerStore((s) => s.selectedDay);
  const days = usePlannerStore((s) => visibleDays(s));
  const focusCity = usePlannerStore((s) => s.focusCity);
  const hasPlan = days.length > 0;
  const [tab, setTab] = useState<Tab>(hasPlan ? 'itinerary' : 'city');
  const city = selectedCityId ? cityById(selectedCityId) : undefined;

  // A city that is part of the plan highlights its day; any other city opens its details.
  useEffect(() => {
    if (!hasPlan) return setTab('city');
    if (selectedCityId && !days.some((d) => d.cityId === selectedCityId)) setTab('city');
    else if (selectedDay !== null) setTab('itinerary');
  }, [selectedCityId, selectedDay, hasPlan, days]);

  const showCity = (cityId: string) => {
    focusCity(cityId);
    setTab('city');
  };

  return (
    <div className="flex flex-col gap-4">
      {hasPlan ? (
        <div
          role="tablist"
          aria-label={t('planner.cityPanel')}
          className="flex gap-1 rounded-full bg-blush p-1"
        >
          {(['itinerary', 'city'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === k ? 'bg-paper text-plum shadow-soft' : 'text-mist hover:text-plum'
              }`}
            >
              {t(k === 'itinerary' ? 'trip.tabItinerary' : 'trip.tabCity')}
            </button>
          ))}
        </div>
      ) : null}
      {tab === 'itinerary' && hasPlan ? (
        <ItineraryPanel onShowCity={showCity} />
      ) : city ? (
        <CityCard city={city} onClose={() => selectCity(null)} />
      ) : (
        <CityList />
      )}
    </div>
  );
}

/**
 * The 3D planner. Desktop: trip panel | map | city panel. Mobile: full-screen
 * map with a draggable bottom sheet. Without WebGL the flat SVG map stands in.
 */
export function PlannerPage() {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  const { webgl } = getDeviceProfile();
  const selectedCityId = useAppStore((s) => s.selectedCityId);
  const user = useAppStore((s) => s.user);
  const hasPlan = usePlannerStore((s) => s.itinerary !== null || s.previews.length > 0);
  if (!user) return null;

  const map = webgl ? (
    <SceneErrorBoundary fallback={<MapFallback title={t('planner.mapTitle')} />}>
      <Suspense fallback={<MapFallback title={t('planner.mapTitle')} />}>
        <MapCanvas />
      </Suspense>
    </SceneErrorBoundary>
  ) : (
    <MapFallback title={t('planner.mapTitle')} />
  );

  if (desktop) {
    return (
      <main
        id="main"
        className="grid h-[100svh] grid-cols-[290px_minmax(0,1fr)_330px] xl:grid-cols-[340px_minmax(0,1fr)_400px] overflow-hidden pt-[61px]"
      >
        <aside
          aria-label={t('planner.tripPanel')}
          className="overflow-y-auto border-r border-blush bg-paper p-5 xl:p-6"
        >
          <TripPanel />
        </aside>
        <section aria-label={t('planner.mapTitle')} className="relative min-h-0 bg-plum">
          {map}
        </section>
        <aside
          aria-label={t('planner.cityPanel')}
          className="overflow-y-auto border-l border-blush bg-paper p-4 xl:p-6"
        >
          <RightPanel />
        </aside>
        <ToolDialogs />
        <TripPrint />
      </main>
    );
  }

  return (
    <main id="main" className="relative h-[100svh] overflow-hidden pt-[61px]">
      <section aria-label={t('planner.mapTitle')} className="relative h-full bg-plum">
        {map}
      </section>
      <BottomSheet label={t('planner.sheet')} open={selectedCityId || hasPlan ? 'half' : 'peek'}>
        <div className="space-y-8 pt-2">
          {selectedCityId || hasPlan ? <RightPanel /> : null}
          <TripPanel />
          {selectedCityId || hasPlan ? null : <RightPanel />}
        </div>
      </BottomSheet>
      <ToolDialogs />
      <TripPrint />
    </main>
  );
}

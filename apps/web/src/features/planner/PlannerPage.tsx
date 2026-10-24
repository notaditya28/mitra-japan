import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../../components/BottomSheet';
import { JapanMapSvg } from '../../components/JapanMapSvg';
import { SceneErrorBoundary } from '../../components/SceneErrorBoundary';
import { getDeviceProfile } from '../../lib/device';
import { navigate } from '../../lib/router';
import { useAppStore } from '../../store/useAppStore';
import { PersonaIcon } from '../persona/PersonaIcon';
import { GuidePanel } from './GuidePanel';
import { ItineraryPanel } from './ItineraryPanel';
import { LayerToggles } from './LayerToggles';
import { usePlannerStore } from './usePlannerStore';
import { ToolDialogs } from '../tools/ToolDialogs';
import { ToolLauncher } from '../tools/ToolLauncher';
import { TripPrint } from '../export/TripPrint';
import { SchedulePrint } from '../schedule/SchedulePrint';
import { UndoToast } from '../assistant/UndoToast';

const MapCanvas = lazy(() => import('./map/MapCanvas'));
const StreetMap = lazy(() => import('./map/StreetMap'));

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

/** Side panel: who is travelling, the AI guide with the day cards, map layers, and the sample route preview. */
function TripPanel() {
  const { t } = useTranslation();
  const user = useAppStore((s) => s.user);
  const persona = useAppStore((s) => s.persona);
  const diet = useAppStore((s) => s.diet);
  const showSampleRoute = useAppStore((s) => s.showSampleRoute);
  const setShowSampleRoute = useAppStore((s) => s.setShowSampleRoute);
  const signOut = useAppStore((s) => s.signOut);
  const hasPlan = usePlannerStore((s) => s.itinerary !== null || s.previews.length > 0);
  const focusCity = usePlannerStore((s) => s.focusCity);

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

      <GuidePanel>{hasPlan ? <ItineraryPanel onShowCity={focusCity} /> : null}</GuidePanel>

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

/**
 * The 3D planner. Desktop: map | trip panel. Mobile: full-screen map with a
 * draggable bottom sheet. Without WebGL the flat SVG map stands in.
 */
export function PlannerPage() {
  const { t } = useTranslation();
  const desktop = useIsDesktop();
  const { webgl } = getDeviceProfile();
  const user = useAppStore((s) => s.user);
  const hasPlan = usePlannerStore((s) => s.itinerary !== null || s.previews.length > 0);
  // Team guide 2.6: switch between the 3D archipelago and a 2D street map.
  const [mapMode, setMapMode] = useState<'3d' | 'street'>('3d');
  if (!user) return null;

  const loading = <MapFallback title={t('planner.mapTitle')} />;
  const threeD = webgl ? (
    <SceneErrorBoundary fallback={loading}>
      <Suspense fallback={loading}>
        <MapCanvas />
      </Suspense>
    </SceneErrorBoundary>
  ) : (
    loading
  );
  const map = (
    <>
      {mapMode === 'street' ? (
        <Suspense fallback={loading}>
          <StreetMap />
        </Suspense>
      ) : (
        threeD
      )}
      <div
        role="group"
        aria-label={t('streetMap.toggle')}
        className={`absolute z-20 flex gap-1 rounded-full bg-plum/85 p-1 shadow-lift backdrop-blur-sm ${
          mapMode === 'street' ? 'bottom-8 right-3' : 'left-3 top-3'
        }`}
      >
        {(['3d', 'street'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mapMode === m}
            onClick={() => setMapMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
              mapMode === m ? 'bg-paper text-plum' : 'text-paper/80 hover:text-paper'
            }`}
          >
            {t(`streetMap.modes.${m}`)}
          </button>
        ))}
      </div>
    </>
  );

  if (desktop) {
    return (
      // The single row is capped at the viewport (minmax(0,1fr)), so the panel scrolls inside
      // itself instead of stretching the page.
      <main
        id="main"
        className="relative grid h-[100svh] grid-cols-[minmax(0,1fr)_360px] grid-rows-[minmax(0,1fr)] overflow-hidden pt-[var(--nav-h,61px)] xl:grid-cols-[minmax(0,1fr)_420px]"
      >
        <section
          id="planner-map"
          aria-label={t('planner.mapTitle')}
          className="relative min-h-0 bg-plum"
        >
          {map}
        </section>
        <aside
          aria-label={t('planner.tripPanel')}
          data-lenis-prevent
          data-scroll-box
          className="relative min-h-0 overflow-y-auto overscroll-contain border-l border-blush bg-paper p-5 xl:p-6"
        >
          <TripPanel />
        </aside>
        <ToolDialogs />
        <TripPrint />
        <SchedulePrint />
        <UndoToast />
      </main>
    );
  }

  return (
    <main id="main" className="relative h-[100svh] overflow-hidden pt-[var(--nav-h,61px)]">
      <section
        id="planner-map"
        aria-label={t('planner.mapTitle')}
        className="relative h-full bg-plum"
      >
        {map}
      </section>
      <BottomSheet label={t('planner.sheet')} open={hasPlan ? 'half' : 'peek'}>
        <div className="pt-2">
          <TripPanel />
        </div>
      </BottomSheet>
      <ToolDialogs />
      <TripPrint />
      <SchedulePrint />
      <UndoToast />
    </main>
  );
}

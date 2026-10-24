import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { getDeviceProfile } from '../../../lib/device';
import { prefectureAt, prefectureCentre } from '../../../lib/japanMap';
import { usePageVisible } from '../../../lib/hooks';
import { Fuji } from '../../../scenes/journey/SunAndFuji';
import { useAppStore } from '../../../store/useAppStore';
import { ANIME_SPOTS, CITIES, FOOD_SPOTS, HERITAGE_SPOTS, REGIONAL_SPOTS } from '../data';
import { SAMPLE_ROUTE } from '../route';
import { usePlannerStore, visibleDays } from '../usePlannerStore';
import { CityMarkers } from './CityMarkers';
import { JapanLand } from './JapanLand';
import { LayerPins, type Pin } from './LayerPins';
import { MapCameraRig } from './MapCameraRig';
import { LAND_HEIGHT, lngLatToWorld } from './mapSpace';
import { RouteLine } from './RouteLine';
import { CityInsightCard } from './CityInsightCard';
import { PrefectureCard } from './PrefectureCard';
import { StopMarker } from './StopMarker';
import { Sea } from './Sea';

const FUJI = lngLatToWorld(138.7274, 35.3606);

/** The planner's 3D Japan: land, sea, Fuji, city markers, layer pins and the route. Lazy-loaded. */
export default function MapCanvas() {
  const { t } = useTranslation();
  const { dpr, tier } = getDeviceProfile();
  const visible = usePageVisible();
  const layers = useAppStore((s) => s.layers);
  const selectedCityId = useAppStore((s) => s.selectedCityId);
  const focusCity = usePlannerStore((s) => s.focusCity);
  const resetCamera = usePlannerStore((s) => s.resetCamera);
  const focusDay = usePlannerStore((s) => s.focusDay);
  const selectedDay = usePlannerStore((s) => s.selectedDay);
  const planDays = usePlannerStore((s) => visibleDays(s));
  const showSampleRoute = useAppStore((s) => s.showSampleRoute);
  const planRoute = useMemo(
    () => planDays.map((d) => ({ cityId: d.cityId, day: d.day })),
    [planDays],
  );
  const hoverChip = useRef<HTMLDivElement>(null);

  // Any prefecture can be selected (it turns see-through); choosing a city selects its prefecture.
  const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>(null);
  useEffect(() => {
    const c = CITIES.find((x) => x.id === selectedCityId);
    if (c) setSelectedPrefecture(prefectureAt(c.lng, c.lat) ?? null);
  }, [selectedCityId]);

  const pins = useMemo(
    () => ({
      vegSafe: FOOD_SPOTS.map<Pin>((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        label: s.title,
        sub: `${s.area} · ${t('planner.demoData')}`,
      })),
      heritage: HERITAGE_SPOTS.map<Pin>((h) => ({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        label: h.japanese,
        sub: `${t('roots.associated', { name: t(`roots.indian.${h.id}`) })} · ${h.place} · ${t('status.needsReview')}`,
      })),
      anime: ANIME_SPOTS.map<Pin>((a) => ({
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        label: a.name,
        sub: a.note,
      })),
      regional: REGIONAL_SPOTS.map<Pin>((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        label: r.name,
        sub: r.note,
      })),
    }),
    [t],
  );

  // A prefecture with none of our cities: fly to it and show what we know (PrefectureCard).
  const [area, setArea] = useState<{ id: string; lng: number; lat: number } | null>(null);
  useEffect(() => {
    if (selectedCityId) setArea(null);
  }, [selectedCityId]);

  const onSelectPrefecture = (prefId: string) => {
    setSelectedPrefecture(prefId);
    const city = CITIES.find((c) => prefectureAt(c.lng, c.lat) === prefId);
    focusCity(city ? city.id : null);
    const centre = city ? undefined : prefectureCentre(prefId);
    setArea(centre ? { id: prefId, lng: centre[0], lat: centre[1] } : null);
  };

  return (
    <div className="relative h-full w-full">
      <Canvas
        flat
        dpr={[1, dpr]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: tier !== 'low' }}
        camera={{ position: [1, 21, 18.5], fov: 40, near: 0.1, far: 300 }}
        onPointerMissed={() => {
          setSelectedPrefecture(null);
          setArea(null);
          focusCity(null);
        }}
        onCreated={(state) => {
          // Dev-only handle for inspecting the map scene from the console.
          if (import.meta.env.DEV) Object.assign(window, { __map: state });
        }}
      >
        <color attach="background" args={['#3A1A2E']} />
        <fog attach="fog" args={['#3A1A2E', 40, 90]} />
        <hemisphereLight args={['#FFE9EF', '#4A2238', 1.15]} />
        <directionalLight position={[-8, 18, 10]} intensity={1.4} color="#FFE6D2" />
        <ambientLight intensity={0.3} color="#F7C6D0" />
        <Sea />
        <JapanLand
          selectedPrefecture={selectedPrefecture}
          onSelect={onSelectPrefecture}
          onHover={(p) => {
            const el = hoverChip.current;
            if (!el) return;
            el.textContent = p ? `${p.nameJa} · ${p.name}` : '';
            el.style.opacity = p ? '1' : '0';
          }}
        />
        <group position={[FUJI[0], LAND_HEIGHT, FUJI[1]]}>
          <Fuji position={[0, 0, 0]} scale={[0.011, 0.028, 0.011]} />
        </group>
        <CityMarkers selectedId={selectedCityId} onSelect={focusCity} />
        <LayerPins layer="vegSafe" pins={pins.vegSafe} visible={layers.vegSafe} />
        <LayerPins layer="heritage" pins={pins.heritage} visible={layers.heritage} />
        <LayerPins layer="anime" pins={pins.anime} visible={layers.anime} />
        <LayerPins layer="regional" pins={pins.regional} visible={layers.regional} />
        {planRoute.length > 0 ? (
          <RouteLine
            stops={planRoute}
            label={t('planner.routeTitle')}
            dayLabel={(n) => t('planner.day', { n })}
            selectedDay={selectedDay}
            onSelectDay={focusDay}
          />
        ) : showSampleRoute ? (
          <RouteLine
            stops={SAMPLE_ROUTE}
            label={t('planner.sampleRoute')}
            dayLabel={(n) => t('planner.day', { n })}
          />
        ) : null}
        <StopMarker />
        <MapCameraRig selectedCityId={selectedCityId} area={area} />
      </Canvas>
      <div
        ref={hoverChip}
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-14 rounded-full bg-plum/85 px-3 py-1.5 text-xs font-semibold text-paper opacity-0 shadow-lift transition-opacity"
      />
      <button
        type="button"
        onClick={() => {
          setSelectedPrefecture(null);
          setArea(null);
          resetCamera();
        }}
        className="absolute right-3 top-14 z-10 rounded-full sm:top-3 bg-plum/85 px-3 py-1.5 text-xs font-semibold text-paper shadow-lift backdrop-blur-sm hover:bg-plum focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        {t('planner.resetCamera')}
      </button>
      <CityInsightCard cityId={selectedCityId} />
      {area && !selectedCityId ? (
        <PrefectureCard
          id={area.id}
          onClose={() => {
            setSelectedPrefecture(null);
            setArea(null);
          }}
        />
      ) : null}
      <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full bg-plum/70 px-3 py-1 text-[11px] text-blush md:block">
        {t('planner.mapHint')}
      </p>
    </div>
  );
}

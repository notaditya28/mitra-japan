import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { useTranslation } from 'react-i18next';
import { getDeviceProfile } from '../../../lib/device';
import { prefectureAt } from '../../../lib/japanMap';
import { usePageVisible } from '../../../lib/hooks';
import { Fuji } from '../../../scenes/journey/SunAndFuji';
import { useAppStore } from '../../../store/useAppStore';
import { ANIME_SPOTS, CITIES, FOOD_SPOTS, HERITAGE_SPOTS, REGIONAL_SPOTS } from '../data';
import { SAMPLE_ROUTE } from '../route';
import { CityMarkers } from './CityMarkers';
import { JapanLand } from './JapanLand';
import { LayerPins, type Pin } from './LayerPins';
import { MapCameraRig } from './MapCameraRig';
import { LAND_HEIGHT, lngLatToWorld } from './mapSpace';
import { RouteLine } from './RouteLine';
import { Sea } from './Sea';

const FUJI = lngLatToWorld(138.7274, 35.3606);

/** The planner's 3D Japan: land, sea, Fuji, city markers, layer pins and the route. Lazy-loaded. */
export default function MapCanvas() {
  const { t } = useTranslation();
  const { dpr, tier } = getDeviceProfile();
  const visible = usePageVisible();
  const layers = useAppStore((s) => s.layers);
  const selectedCityId = useAppStore((s) => s.selectedCityId);
  const selectCity = useAppStore((s) => s.selectCity);
  const showSampleRoute = useAppStore((s) => s.showSampleRoute);
  const hoverChip = useRef<HTMLDivElement>(null);

  const selectedPrefecture = useMemo(() => {
    const c = CITIES.find((x) => x.id === selectedCityId);
    return c ? (prefectureAt(c.lng, c.lat) ?? null) : null;
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

  const onSelectPrefecture = (prefId: string) => {
    const city = CITIES.find((c) => prefectureAt(c.lng, c.lat) === prefId);
    if (city) selectCity(city.id);
  };

  return (
    <div className="relative h-full w-full">
      <Canvas
        flat
        dpr={[1, dpr]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: tier !== 'low' }}
        camera={{ position: [1, 21, 18.5], fov: 40, near: 0.1, far: 300 }}
        onPointerMissed={() => selectCity(null)}
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
        <CityMarkers selectedId={selectedCityId} onSelect={selectCity} />
        <LayerPins layer="vegSafe" pins={pins.vegSafe} visible={layers.vegSafe} />
        <LayerPins layer="heritage" pins={pins.heritage} visible={layers.heritage} />
        <LayerPins layer="anime" pins={pins.anime} visible={layers.anime} />
        <LayerPins layer="regional" pins={pins.regional} visible={layers.regional} />
        {showSampleRoute ? (
          <RouteLine
            stops={SAMPLE_ROUTE}
            label={t('planner.sampleRoute')}
            dayLabel={(n) => t('planner.day', { n })}
          />
        ) : null}
        <MapCameraRig selectedCityId={selectedCityId} />
      </Canvas>
      <div
        ref={hoverChip}
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-4 rounded-full bg-plum/85 px-3 py-1.5 text-xs font-semibold text-paper opacity-0 shadow-lift transition-opacity"
      />
      <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full bg-plum/70 px-3 py-1 text-[11px] text-blush md:block">
        {t('planner.mapHint')}
      </p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { gsap } from 'gsap';
import { Petals3D } from '../components/motifs/Petals3D';
import { getDeviceProfile } from '../lib/device';
import { usePageVisible } from '../lib/hooks';
import { journey, stage } from './journeyState';
import { CameraRig } from './journey/CameraRig';
import { FollowCamera } from './journey/FollowCamera';
import { Atmosphere } from './journey/Sky';
import { FlightScene } from './journey/FlightScene';
import { SceneFade } from './journey/SceneFade';
import { ShinkansenScene } from './journey/ShinkansenScene';
import { refreshSignTextures } from './journey/signs';
import { FujiScene } from './places/FujiScene';
import { KyotoScene } from './places/KyotoScene';
import { MatsuriScene } from './places/MatsuriScene';
import { TokyoScene } from './places/TokyoScene';

interface JourneyCanvasProps {
  /** Element whose visibility decides whether the scene renders at all. */
  watchId: string;
}

/**
 * The single fixed WebGL canvas behind Stage 1: the flight over Asia, each spot's
 * low-poly scene (Tokyo, Fuji, Kyoto, the Gion matsuri) and the Shinkansen between cities. All are built up front but only the
 * active one is visible, so only one renders per frame. Lazy-loaded; paused while
 * offscreen or the tab is hidden.
 */
export default function JourneyCanvas({ watchId }: JourneyCanvasProps) {
  const { dpr, petals, tier } = getDeviceProfile();
  const pageVisible = usePageVisible();
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);
  const trees = tier === 'high' ? 56 : 32;

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      journey.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      journey.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    const intro = gsap.to(journey, { intro: 1, duration: 3.4, ease: 'power2.out', delay: 0.2 });
    // Sign textures drawn before the Japanese font arrived get redrawn once it has.
    void document.fonts.ready.then(refreshSignTextures);
    return () => {
      window.removeEventListener('pointermove', onMove);
      intro.kill();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-1000 ease-calm"
      style={{
        opacity: inView ? 1 : 0,
        // Same plum as the flight map, shown until the first frame lands.
        background: 'linear-gradient(180deg, #1A0C18 0%, #3A1A2E 60%, #4A2238 100%)',
      }}
    >
      <Canvas
        flat
        dpr={[1, dpr]}
        frameloop={pageVisible && inView ? 'always' : 'never'}
        gl={{ antialias: tier === 'high', powerPreference: 'high-performance' }}
        camera={{ position: [0, 40, 30], fov: 50, near: 0.1, far: 1200 }}
        onCreated={(state) => {
          setReady(true);
          // Dev-only handle for inspecting the scene from the console.
          if (import.meta.env.DEV) Object.assign(window, { __journey: state, __stage: stage });
        }}
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 1.2s ease' }}
      >
        {/* CameraRig computes the stage, so it must be first. */}
        <CameraRig />
        <Atmosphere />
        <FlightScene />
        <TokyoScene />
        <FujiScene trees={trees} />
        <ShinkansenScene trees={trees} />
        <KyotoScene trees={trees} />
        <MatsuriScene />
        {/* Petals stay 5+ units from the lens so none blur across the screen. */}
        <FollowCamera offset={[0, 0, -8.5]}>
          <Petals3D
            count={Math.round(petals * 0.8)}
            area={[10, 5.5, 3.5]}
            speed={() => 1 + stage.warp * 0.4}
          />
        </FollowCamera>
        <SceneFade />
      </Canvas>
    </div>
  );
}

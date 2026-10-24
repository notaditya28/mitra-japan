import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { gsap } from 'gsap';
import { Petals3D } from '../components/motifs/Petals3D';
import { getDeviceProfile } from '../lib/device';
import { usePageVisible } from '../lib/hooks';
import { journey, stage } from './journeyState';
import { CameraRig } from './journey/CameraRig';
import { FollowCamera } from './journey/FollowCamera';
import { PetalPortal } from './journey/PetalPortal';
import { Atmosphere } from './journey/Sky';
import { FlightScene } from './journey/FlightScene';
import { PhotoScene, preloadFirstSpots } from './journey/PhotoScene';
import { ShinkansenScene } from './journey/ShinkansenScene';

interface JourneyCanvasProps {
  /** Element whose visibility decides whether the scene renders at all. */
  watchId: string;
}

/**
 * The single fixed WebGL canvas behind Stage 1: the flight over Asia, the spot
 * photos and the Shinkansen between cities. All are built up front but only the
 * active one is visible, so only one renders per frame. Lazy-loaded; paused while
 * offscreen or the tab is hidden.
 */
export default function JourneyCanvas({ watchId }: JourneyCanvasProps) {
  const { dpr, petals, tier } = getDeviceProfile();
  const pageVisible = usePageVisible();
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);
  const trees = tier === 'high' ? 56 : 32;
  // Big screens on capable devices get the 2048 px photos.
  const large = tier === 'high' && window.innerWidth * Math.min(2, window.devicePixelRatio) >= 1600;

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
          preloadFirstSpots(large);
          // Dev-only handle for inspecting the scene from the console.
          if (import.meta.env.DEV) Object.assign(window, { __journey: state, __stage: stage });
        }}
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 1.2s ease' }}
      >
        {/* CameraRig computes the stage, so it must be first. */}
        <CameraRig />
        <Atmosphere />
        <FlightScene />
        <PhotoScene large={large} />
        <ShinkansenScene trees={trees} />
        {/* Petals stay 5+ units from the lens so none blur across the screen. */}
        <FollowCamera offset={[0, 0, -8.5]}>
          <Petals3D
            count={Math.round(petals * 0.8)}
            area={[10, 5.5, 3.5]}
            speed={() => 1 + stage.warp * 0.4}
          />
        </FollowCamera>
        <PetalPortal count={tier === 'high' ? 1100 : 650} />
      </Canvas>
    </div>
  );
}

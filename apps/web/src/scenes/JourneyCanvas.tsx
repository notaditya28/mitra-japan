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
import { refreshSignTextures } from './journey/signs';
import { FujiScene } from './places/FujiScene';
import { TokyoScene } from './places/TokyoScene';
import { ShinkansenScene } from './places/ShinkansenScene';
import { KyotoScene } from './places/KyotoScene';
import { MatsuriScene } from './places/MatsuriScene';

interface JourneyCanvasProps {
  /** Element whose visibility decides whether the scene renders at all. */
  watchId: string;
}

/**
 * The single fixed WebGL canvas behind Stage 1. All five places are built up
 * front but only the active one is visible, so only one renders per frame.
 * Lazy-loaded; paused while offscreen or the tab is hidden.
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
        // Same dawn gradient as the first sky, shown until the first frame lands.
        background: 'linear-gradient(180deg, #2E1424 0%, #6E2F52 45%, #E07A8F 100%)',
      }}
    >
      <Canvas
        flat
        dpr={[1, dpr]}
        frameloop={pageVisible && inView ? 'always' : 'never'}
        gl={{ antialias: tier === 'high', powerPreference: 'high-performance' }}
        camera={{ position: [0, 2.6, 19], fov: 50, near: 0.1, far: 1200 }}
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
        <FujiScene trees={trees} />
        <TokyoScene />
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
        <PetalPortal count={tier === 'high' ? 1100 : 650} />
      </Canvas>
    </div>
  );
}

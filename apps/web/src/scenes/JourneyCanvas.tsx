import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { gsap } from 'gsap';
import { Petals3D } from '../components/motifs/Petals3D';
import { getDeviceProfile } from '../lib/device';
import { usePageVisible } from '../lib/hooks';
import { palette } from '../styles/tokens';
import { journey } from './journeyState';
import { CameraRig } from './journey/CameraRig';
import { FollowCamera } from './journey/FollowCamera';
import { Landscape } from './journey/Landscape';
import { Sky } from './journey/Sky';
import { SunAndFuji } from './journey/SunAndFuji';
import { ToriiRow } from './journey/ToriiRow';

interface JourneyCanvasProps {
  /** Element whose visibility decides whether the scene renders at all. */
  watchId: string;
}

/**
 * The single fixed WebGL canvas behind Stage 1. Lazy-loaded; renders only
 * while the immersive sections are on screen and the tab is visible.
 */
export default function JourneyCanvas({ watchId }: JourneyCanvasProps) {
  const { dpr, petals, tier } = getDeviceProfile();
  const pageVisible = usePageVisible();
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);

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
        // Same dawn gradient as the sky, shown until the first frame lands.
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
          if (import.meta.env.DEV) Object.assign(window, { __journey: state });
        }}
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 1.2s ease' }}
      >
        <hemisphereLight args={['#FFD9E2', '#5A2C45', 1.1]} />
        <directionalLight position={[6, 14, 22]} intensity={1.6} color="#FFE6D2" />
        <ambientLight intensity={0.35} color={palette.petal} />
        <Sky />
        <SunAndFuji />
        <Landscape trees={tier === 'high' ? 56 : 32} />
        <ToriiRow />
        <CameraRig />
        <FollowCamera>
          <Petals3D count={Math.round(petals * 0.8)} area={[9, 5, 6]} />
        </FollowCamera>
      </Canvas>
    </div>
  );
}

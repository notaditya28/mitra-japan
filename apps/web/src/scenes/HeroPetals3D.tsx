import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Petals3D } from '../components/motifs/Petals3D';
import { getDeviceProfile } from '../lib/device';
import { usePageVisible } from '../lib/hooks';

/**
 * Lazy-loaded WebGL petal layer for the hero. Transparent, non-interactive.
 * The render loop stops when the tab is hidden or the hero scrolls away.
 */
export default function HeroPetals3D() {
  const { dpr, petals } = getDeviceProfile();
  const visible = usePageVisible();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <Canvas
        flat
        dpr={[1, dpr]}
        frameloop={visible && inView ? 'always' : 'never'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 8], fov: 45 }}
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} color="#FFE9D6" />
        <Petals3D count={petals} />
      </Canvas>
    </div>
  );
}

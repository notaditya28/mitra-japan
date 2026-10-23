import { useEffect, useRef } from 'react';
import { getDeviceProfile } from '../../lib/device';
import { usePageVisible, useReducedMotion } from '../../lib/hooks';
import { tracePetal } from './petalShape';

interface Petal {
  x: number;
  y: number;
  size: number;
  rot: number;
  spin: number;
  fall: number;
  sway: number;
  phase: number;
  tumble: number;
  hue: number;
}

const COLORS = ['#F7C6D0', '#FBE3EA', '#F2A9BC'];

interface Petals2DProps {
  className?: string;
  /** Multiplier on the device-tier petal count. */
  density?: number;
}

/**
 * Lightweight canvas petals. Used as the first-paint layer and as the fallback
 * when WebGL is unavailable. Pauses when the tab is hidden or it is offscreen,
 * and renders nothing for reduced-motion users.
 */
export function Petals2D({ className = '', density = 0.5 }: Petals2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const visible = usePageVisible();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced || !visible) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const profile = getDeviceProfile();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0;
    let height = 0;
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const count = Math.max(8, Math.round(profile.petals * density));
    const spawn = (initial: boolean): Petal => ({
      x: Math.random() * width,
      y: initial ? Math.random() * height : -20,
      size: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.02,
      fall: 0.25 + Math.random() * 0.45,
      sway: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      tumble: 0.01 + Math.random() * 0.02,
      hue: Math.floor(Math.random() * COLORS.length),
    });
    const petals = Array.from({ length: count }, () => spawn(true));

    let inView = true;
    const io = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
    });
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;
      if (!inView) return;
      ctx.clearRect(0, 0, width, height);
      for (const p of petals) {
        p.phase += p.tumble * dt;
        p.y += p.fall * dt;
        p.x += Math.sin(p.phase) * p.sway * dt + 0.15 * dt;
        p.rot += p.spin * dt;
        if (p.y > height + 20 || p.x > width + 20) Object.assign(p, spawn(false));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(Math.cos(p.phase * 1.7) * 0.6 + 0.4, 1);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = COLORS[p.hue] ?? '#F7C6D0';
        tracePetal(ctx, p.size);
        ctx.fill();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [reduced, visible, density]);

  if (reduced) return null;
  return (
    <canvas ref={canvasRef} className={`pointer-events-none ${className}`} aria-hidden="true" />
  );
}

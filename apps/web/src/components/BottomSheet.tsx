import { useEffect, useState, type ReactNode } from 'react';
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';

type Snap = 'peek' | 'half' | 'full';

interface BottomSheetProps {
  children: ReactNode;
  label: string;
  /** Jump to this snap point when it changes (e.g. open fully when a city is picked). */
  open?: Snap;
}

const PEEK = 132;

function offsetsFor(vh: number): Record<Snap, number> {
  return { full: vh * 0.12, half: vh * 0.5, peek: vh - PEEK };
}

/**
 * Mobile bottom sheet with three snap points. Drag the handle, or use the
 * handle button (keyboard) to cycle sizes.
 */
export function BottomSheet({ children, label, open = 'peek' }: BottomSheetProps) {
  const [vh, setVh] = useState(() => window.innerHeight);
  const [snap, setSnap] = useState<Snap>(open);
  const y = useMotionValue(offsetsFor(window.innerHeight)[open]);

  const offsets = offsetsFor(vh);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => setSnap(open), [open]);

  useEffect(() => {
    const controls = animate(y, offsetsFor(vh)[snap], {
      type: 'spring',
      stiffness: 320,
      damping: 34,
    });
    return () => controls.stop();
  }, [snap, vh, y]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const current = y.get() + info.velocity.y * 0.2;
    const nearest = (Object.keys(offsets) as Snap[]).reduce((a, b) =>
      Math.abs(offsets[a] - current) < Math.abs(offsets[b] - current) ? a : b,
    );
    setSnap(nearest);
  };

  const cycle = () => setSnap((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));

  return (
    <motion.section
      aria-label={label}
      className="fixed inset-x-0 top-0 z-30 flex h-[100svh] flex-col rounded-t-card-lg border-t border-blush bg-paper shadow-lift"
      style={{ y }}
      drag="y"
      dragConstraints={{ top: offsets.full, bottom: offsets.peek }}
      dragElastic={0.08}
      dragMomentum={false}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        onClick={cycle}
        aria-label={label}
        aria-expanded={snap !== 'peek'}
        className="mx-auto mt-2 flex h-6 w-24 items-center justify-center"
      >
        <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-petal" />
      </button>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+12vh)]"
        onPointerDownCapture={(e) => {
          // Let the content scroll normally once the sheet is open.
          if (snap !== 'peek') e.stopPropagation();
        }}
      >
        {children}
      </div>
    </motion.section>
  );
}

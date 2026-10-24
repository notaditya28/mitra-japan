import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Crop } from './ocr/image';

const MIN = 0.1;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Photo preview with a crop guide (team guide: "instant canvas preview with interactive
 * crop guidelines"). Drag the frame to move it, drag the corner to resize it; with the
 * keyboard, arrows move and Shift+arrows resize. Only the framed part is read.
 */
export function CropGuide({
  src,
  onScan,
  onCancel,
}: {
  src: string;
  onScan: (crop: Crop | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<Crop>({ x: 0.1, y: 0.15, w: 0.8, h: 0.7 });
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; start: Crop } | null>(null);

  const begin = (mode: 'move' | 'resize') => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, start: crop };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    const r = box.current?.getBoundingClientRect();
    if (!d || !r) return;
    const dx = (e.clientX - d.x) / r.width;
    const dy = (e.clientY - d.y) / r.height;
    const s = d.start;
    setCrop(
      d.mode === 'move'
        ? { ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) }
        : { ...s, w: clamp(s.w + dx, MIN, 1 - s.x), h: clamp(s.h + dy, MIN, 1 - s.y) },
    );
  };
  const end = () => {
    drag.current = null;
  };

  const onKey = (e: KeyboardEvent) => {
    const step = 0.03;
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const k = keys[e.key];
    if (!k) return;
    e.preventDefault();
    const [dx, dy] = k;
    setCrop((c) =>
      e.shiftKey
        ? { ...c, w: clamp(c.w + dx, MIN, 1 - c.x), h: clamp(c.h + dy, MIN, 1 - c.y) }
        : { ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-mist">{t('scanner.crop.hint')}</p>
      <div
        ref={box}
        className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-blush bg-plum"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <img
          src={src}
          alt={t('scanner.photoAlt')}
          className="block max-h-72 w-full object-contain"
          draggable={false}
        />
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('scanner.crop.frame')}
          aria-valuetext={t('scanner.crop.value', {
            x: Math.round(crop.x * 100),
            y: Math.round(crop.y * 100),
            w: Math.round(crop.w * 100),
            h: Math.round(crop.h * 100),
          })}
          onKeyDown={onKey}
          onPointerDown={begin('move')}
          className="absolute cursor-move rounded-md border-2 border-dashed border-gold shadow-[0_0_0_9999px_rgb(46_20_36/0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
          }}
        >
          <span
            aria-hidden="true"
            onPointerDown={begin('resize')}
            className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-paper bg-gold"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onScan(crop)}
          className="btn-primary !px-4 !py-2 text-sm"
        >
          {t('scanner.crop.scanFrame')}
        </button>
        <button
          type="button"
          onClick={() => onScan(null)}
          className="btn-ghost !px-4 !py-2 text-sm text-plum"
        >
          {t('scanner.crop.scanAll')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold text-rose underline-offset-4 hover:underline"
        >
          {t('trip.cancel')}
        </button>
      </div>
    </div>
  );
}

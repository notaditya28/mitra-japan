import * as THREE from 'three';

const JP_FONT = '"Shippori Mincho", "Yu Gothic", "Hiragino Sans", "Noto Sans JP", sans-serif';

export interface SignOptions {
  text: string;
  /** Characters stacked top to bottom (tategaki), like most shop signs. */
  vertical?: boolean;
  bg: string;
  fg: string;
  /** Neon glow colour around the glyphs. */
  glow?: string;
  border?: string;
  width?: number;
  height?: number;
}

const cache = new Map<string, THREE.CanvasTexture>();

/**
 * Canvas-drawn shop sign / lantern / noren texture. Cached by options so
 * repeated signs share one GPU texture.
 */
export function signTexture(opts: SignOptions): THREE.CanvasTexture {
  const key = JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;

  const { text, vertical = false, bg, fg, glow, border } = opts;
  const width = opts.width ?? (vertical ? 128 : 512);
  const height = opts.height ?? (vertical ? 512 : 128);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = Math.min(width, height) * 0.06;
      ctx.strokeRect(
        ctx.lineWidth,
        ctx.lineWidth,
        width - ctx.lineWidth * 2,
        height - ctx.lineWidth * 2,
      );
    }
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = Math.min(width, height) * 0.18;
    }
    const chars = [...text];
    if (vertical) {
      const size = Math.min(width * 0.72, (height * 0.86) / chars.length);
      ctx.font = `700 ${size}px ${JP_FONT}`;
      const start = height / 2 - ((chars.length - 1) * size) / 2;
      chars.forEach((ch, i) => ctx.fillText(ch, width / 2, start + i * size));
    } else {
      const size = Math.min(height * 0.62, (width * 0.9) / Math.max(1, chars.length));
      ctx.font = `700 ${size}px ${JP_FONT}`;
      ctx.fillText(text, width / 2, height / 2 + size * 0.04);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/** Fonts can finish loading after textures were drawn; redraw them once they have. */
export function refreshSignTextures(): void {
  const entries = [...cache.entries()];
  cache.clear();
  for (const [key, old] of entries) {
    const fresh = signTexture(JSON.parse(key) as SignOptions);
    old.image = fresh.image;
    old.needsUpdate = true;
    cache.set(key, old);
  }
}

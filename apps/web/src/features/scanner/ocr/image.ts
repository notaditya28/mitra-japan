/** Longest side we hand to OCR: big phone photos are slow and no more accurate. */
const MAX_SIDE = 2000;

/** Part of a photo to read, as fractions of its width and height (0..1). */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixel rectangle for a crop, clamped to the image. */
export function cropRect(crop: Crop | null, width: number, height: number) {
  if (!crop) return { sx: 0, sy: 0, sw: width, sh: height };
  const sx = Math.round(Math.min(Math.max(crop.x, 0), 1) * width);
  const sy = Math.round(Math.min(Math.max(crop.y, 0), 1) * height);
  const sw = Math.max(1, Math.min(width - sx, Math.round(crop.w * width)));
  const sh = Math.max(1, Math.min(height - sy, Math.round(crop.h * height)));
  return { sx, sy, sw, sh };
}

/** Decode a photo, crop it to the guide, fix its size, and return a canvas the OCR engine can read. */
export async function prepareImage(
  file: Blob,
  crop: Crop | null = null,
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { sx, sy, sw, sh } = cropRect(crop, bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

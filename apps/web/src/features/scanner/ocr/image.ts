/** Longest side we hand to OCR: big phone photos are slow and no more accurate. */
const MAX_SIDE = 2000;

/** Decode a photo, fix its size, and return a canvas the OCR engine can read. */
export async function prepareImage(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export const ACCEPTED_IMAGES = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

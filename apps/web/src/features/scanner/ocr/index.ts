import type { OcrProvider } from './provider';

export type { OcrProgress, OcrProvider, OcrResult } from './provider';
export { LOW_CONFIDENCE, OcrAbortedError } from './provider';

type Loader = () => Promise<OcrProvider>;

/** Registered providers. Add a cloud provider here and select it with VITE_OCR_PROVIDER. */
const PROVIDERS: Record<string, Loader> = {
  tesseract: () => import('./tesseract').then((m) => m.tesseractProvider),
};

export const DEFAULT_OCR = 'tesseract';

export function ocrProviderName(env: string | undefined): string {
  return env && env in PROVIDERS ? env : DEFAULT_OCR;
}

/** Lazy: the OCR engine is only downloaded when someone scans a photo. */
export function loadOcrProvider(
  name = ocrProviderName(import.meta.env.VITE_OCR_PROVIDER as string | undefined),
): Promise<OcrProvider> {
  const load = PROVIDERS[name] ?? PROVIDERS[DEFAULT_OCR];
  if (!load) throw new Error('No OCR provider registered');
  return load();
}

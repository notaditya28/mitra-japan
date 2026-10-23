/**
 * OCR sits behind this interface (owner rule) so a cloud provider can be
 * added later without touching the scanner UI. Tesseract.js is the default.
 */
export interface OcrResult {
  text: string;
  /** 0-100, as reported by the engine. */
  confidence: number;
}

export interface OcrProgress {
  /** Engine-reported stage, e.g. "loading language traineddata" or "recognizing text". */
  stage: 'loading' | 'recognizing';
  /** 0..1 within the stage. */
  progress: number;
}

export interface OcrProvider {
  id: string;
  /** Runs in the browser (true) or sends the image to a server (false). */
  onDevice: boolean;
  recognize(
    image: Blob | HTMLCanvasElement,
    opts?: { signal?: AbortSignal; onProgress?: (p: OcrProgress) => void },
  ): Promise<OcrResult>;
}

/** Below this the text is too unreliable to judge until the traveller checks it. */
export const LOW_CONFIDENCE = 55;

export class OcrAbortedError extends Error {
  constructor() {
    super('OCR cancelled');
    this.name = 'OcrAbortedError';
  }
}

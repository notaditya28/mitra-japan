import type { Worker } from 'tesseract.js';
import { OcrAbortedError, type OcrProvider } from './provider';

/** Spaces Tesseract puts between Japanese characters; they carry no meaning. */
const JA = '[\\u3000-\\u30ff\\u3400-\\u9fff\\uff00-\\uffef]';
const JA_GAP = new RegExp(`(?<=${JA}) +(?=${JA})`, 'g');

let workerPromise: Promise<Worker> | null = null;
let report: ((stage: 'loading' | 'recognizing', progress: number) => void) | null = null;

/**
 * One shared worker, created on first use, reading Japanese and English (team guide:
 * jpn + eng, for bilingual packaging). tesseract.js and the
 * language data (a few MB) are fetched from its default CDN the first time;
 * the browser caches them afterwards.
 */
function getWorker(): Promise<Worker> {
  workerPromise ??= import('tesseract.js').then(({ createWorker }) =>
    createWorker(['jpn', 'eng'], undefined, {
      logger: (m) =>
        report?.(m.status === 'recognizing text' ? 'recognizing' : 'loading', m.progress),
    }),
  );
  workerPromise.catch(() => {
    workerPromise = null;
  });
  return workerPromise;
}

export const tesseractProvider: OcrProvider = {
  id: 'tesseract',
  onDevice: true,
  async recognize(image, opts = {}) {
    const { signal, onProgress } = opts;
    if (signal?.aborted) throw new OcrAbortedError();
    report = (stage, progress) => onProgress?.({ stage, progress });
    try {
      const worker = await getWorker();
      if (signal?.aborted) throw new OcrAbortedError();
      const abort = new Promise<never>((_, reject) =>
        signal?.addEventListener('abort', () => reject(new OcrAbortedError()), { once: true }),
      );
      const { data } = await Promise.race([worker.recognize(image), abort]);
      const text = data.text.replace(JA_GAP, '').trim();
      return { text, confidence: data.confidence };
    } finally {
      report = null;
    }
  },
};

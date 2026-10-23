import { describe, expect, it } from 'vitest';
import { DEFAULT_OCR, ocrProviderName } from './index';

describe('OCR provider selection', () => {
  it('defaults to Tesseract and ignores unknown names', () => {
    expect(ocrProviderName(undefined)).toBe(DEFAULT_OCR);
    expect(ocrProviderName('')).toBe('tesseract');
    expect(ocrProviderName('magic-cloud')).toBe('tesseract');
    expect(ocrProviderName('tesseract')).toBe('tesseract');
  });
});

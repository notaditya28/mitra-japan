import i18n from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { initReactI18next } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import GallerySection from './GallerySection';
import { GALLERY } from './galleryData';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
});

describe('gallery without motion (reduced motion / low-end devices)', () => {
  const html = renderToStaticMarkup(<GallerySection scrubbed={false} />);

  it('is a keyboard-scrollable strip with every item and its credit', () => {
    expect(html.match(/role="region"/g)?.length).toBe(2);
    expect(html.match(/tabindex="0"/g)?.length).toBe(2);
    for (const it of GALLERY.items) expect(html).toContain(it.credit.sourceUrl.replace(/&/g, '&amp;'));
  });

  it('never autoplays: clips get controls and stay muted', () => {
    const videos = html.match(/<video[^>]*>/g) ?? [];
    expect(videos.length).toBe(GALLERY.items.filter((i) => i.kind === 'video').length);
    for (const v of videos) {
      expect(v).toContain('controls');
      expect(v).toContain('muted');
      expect(v).toContain('preload="none"');
      expect(v).not.toContain('autoplay');
    }
  });

  it('shows the review status and the source', () => {
    expect(html).toContain('Needs review');
    expect(html).toContain('Wikimedia Commons');
  });
});

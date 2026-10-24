import i18n from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { initReactI18next } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import { TourStatic } from './TourStatic';
import { TOUR_CITIES } from './tour';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
});

describe('static journey (reduced motion / no WebGL)', () => {
  const html = renderToStaticMarkup(<TourStatic />);

  it('shows every city and every spot', () => {
    for (const city of TOUR_CITIES) {
      expect(html).toContain(city.name);
      for (const s of city.spots) expect(html).toContain(s.name.replace(/&/g, '&amp;'));
    }
  });

  it('labels every spot as needing review', () => {
    const spots = TOUR_CITIES.flatMap((c) => c.spots).length;
    expect(html.match(/Needs review/g)?.length).toBe(spots);
  });
});

import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import { GALLERY, galleryRows } from './galleryData';

const ITEMS = GALLERY.items;
// Files shipped in public/gallery, as their served paths ("/gallery/x.webp").
const SHIPPED = new Set(
  Object.keys(import.meta.glob('../../../public/gallery/*')).map((f) => f.replace('../../../public', '')),
);
const FREE = /^(CC BY(-SA)? \d\.\d( [A-Za-z ]+)?|CC0|Public domain)$/i;

describe('Japan in pictures', () => {
  it('has photos and a few clips', () => {
    expect(ITEMS.filter((i) => i.kind === 'photo').length).toBeGreaterThanOrEqual(25);
    const clips = ITEMS.filter((i) => i.kind === 'video');
    expect(clips.length).toBeGreaterThanOrEqual(2);
    expect(clips.length).toBeLessThanOrEqual(4);
  });

  it('credits every item with a free licence and its Commons page, and keeps it under review', () => {
    for (const it of ITEMS) {
      expect(it.status, it.id).toBe('needs-review');
      expect(it.credit.licence, it.id).toMatch(FREE);
      expect(it.credit.author.trim(), it.id).not.toBe('');
      expect(it.credit.sourceUrl, it.id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(it.credit.changes, it.id).not.toBe('');
    }
  });

  it('ships every file it lists, and clips have a poster', () => {
    expect(SHIPPED.size).toBeGreaterThan(0);
    for (const it of ITEMS) {
      expect(SHIPPED.has(it.src), it.src).toBe(true);
      if (it.kind === 'video') {
        expect(it.src).toMatch(/\.mp4$/);
        expect(SHIPPED.has(it.poster ?? ''), it.id).toBe(true);
      }
    }
  });

  it('labels every category and keeps every item when splitting into rows', () => {
    for (const it of ITEMS) expect(en.gallery.categories, it.category).toHaveProperty(it.category);
    const [a, b] = galleryRows(ITEMS);
    expect([...a, ...b].map((i) => i.id).sort()).toEqual(ITEMS.map((i) => i.id).sort());
    expect(Math.abs(a.length - b.length)).toBeLessThanOrEqual(1);
    // Clips are spread out: each row ends on a photo, not a pile of clips.
    expect(a.at(-1)?.kind).toBe('photo');
    expect(b.at(-1)?.kind).toBe('photo');
  });
});

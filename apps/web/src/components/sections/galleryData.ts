import gallery from '../../data/gallery.json';

export interface GalleryItem {
  id: string;
  kind: 'photo' | 'video';
  name: string;
  place: string;
  category: string;
  src: string;
  poster?: string;
  width: number;
  height: number;
  credit: {
    title: string;
    author: string;
    licence: string;
    licenceUrl: string | null;
    sourceUrl: string;
    changes: string;
  };
  status: 'verified' | 'sample' | 'needs-review';
}

export const GALLERY = gallery as {
  source: string;
  lastChecked: string;
  items: GalleryItem[];
};

/** Spread the clips evenly through the photos, then deal everything into two rows. */
export function galleryRows(items: GalleryItem[]): [GalleryItem[], GalleryItem[]] {
  const photos = items.filter((i) => i.kind === 'photo');
  const clips = items.filter((i) => i.kind === 'video');
  const mixed = [...photos];
  const step = Math.floor(photos.length / (clips.length + 1));
  clips.forEach((c, k) => mixed.splice((k + 1) * step + k, 0, c));
  const a: GalleryItem[] = [];
  const b: GalleryItem[] = [];
  mixed.forEach((it, i) => (i % 2 === 0 ? a : b).push(it));
  return [a, b];
}

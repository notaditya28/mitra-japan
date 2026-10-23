import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ToriiGate } from '../motifs/ToriiGate';
import { FoodScanPreview } from '../../features/fears/FoodScanPreview';
import { PhrasePreview } from '../../features/fears/PhrasePreview';
import { VisaChecklist } from '../../features/fears/VisaChecklist';
import { RootsTeaser } from '../../features/fears/RootsTeaser';
import { SectionHeader } from './SectionHeader';

type FearId = 'food' | 'language' | 'visa' | 'foreign';

const FEARS: { id: FearId; preview: ReactNode }[] = [
  { id: 'food', preview: <FoodScanPreview /> },
  { id: 'language', preview: <PhrasePreview /> },
  { id: 'visa', preview: <VisaChecklist /> },
  { id: 'foreign', preview: <RootsTeaser /> },
];

/**
 * Static fear-to-answer layout. This is also the reduced-motion path;
 * milestone 2 layers the 3D torii tunnel on top of it.
 */
export function FearsSection() {
  const { t } = useTranslation();
  return (
    <section id="fears" aria-labelledby="fears-title" className="bg-blush/40">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
        <SectionHeader
          id="fears-title"
          eyebrow={t('fears.eyebrow')}
          title={t('fears.title')}
          body={t('fears.body')}
        />
        <div className="grid gap-6 md:grid-cols-2">
          {FEARS.map(({ id, preview }, i) => (
            <article key={id} className="card flex flex-col gap-5 p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <ToriiGate className="h-11 w-12 shrink-0" />
                <div>
                  <p className="eyebrow text-mist">Gate {i + 1}</p>
                  <h3 className="font-display text-2xl text-plum">{t(`fears.items.${id}.q`)}</h3>
                </div>
              </div>
              <p className="text-ink">{t(`fears.items.${id}.a`)}</p>
              <div className="mt-auto">{preview}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

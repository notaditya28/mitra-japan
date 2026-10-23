import { useTranslation } from 'react-i18next';
import { Seigaiha } from '../motifs/Seigaiha';
import { PersonaPicker } from '../../features/persona/PersonaPicker';
import { SectionHeader } from './SectionHeader';

export function PersonaSection({ immersive }: { immersive: boolean }) {
  const { t } = useTranslation();
  return (
    <section id="persona" aria-labelledby="persona-title" className="relative isolate">
      {immersive ? null : <Seigaiha className="absolute inset-0 -z-10" />}
      <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-4 py-24 sm:px-8 sm:py-32">
        <SectionHeader
          id="persona-title"
          dark={immersive}
          eyebrow={t('persona.eyebrow')}
          title={t('persona.title')}
          body={t('persona.body')}
        />
        <PersonaPicker />
      </div>
    </section>
  );
}

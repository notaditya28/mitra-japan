import { useTranslation } from 'react-i18next';
import { Fuji } from '../motifs/Fuji';
import { Lantern } from '../motifs/Lantern';
import { ToriiGate } from '../motifs/ToriiGate';
import { startTrip } from '../../features/auth/startTrip';

export function CtaSection() {
  const { t } = useTranslation();

  return (
    <section
      id="cta"
      aria-labelledby="cta-title"
      className="relative isolate overflow-hidden bg-blush/50"
    >
      <Lantern className="absolute left-[6%] top-10 -z-10 hidden w-20 md:block" />
      <Lantern className="absolute right-[8%] top-24 -z-10 hidden w-16 md:block" />
      <div className="mx-auto max-w-3xl px-4 pb-64 pt-28 text-center sm:px-8">
        <ToriiGate className="mx-auto mb-8 h-20 w-24" />
        <p className="eyebrow mb-4 text-rose">{t('cta.eyebrow')}</p>
        <h2 id="cta-title" className="display text-5xl text-plum sm:text-6xl">
          {t('cta.title')}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-mist">{t('cta.body')}</p>
        <button type="button" className="btn-primary mt-9 text-lg" onClick={startTrip}>
          {t('cta.button')}
        </button>
      </div>
      <Fuji
        className="absolute inset-x-0 bottom-0 -z-10 h-56 w-full"
        body="#F7C6D0"
        snow="#FFF8FA"
        hills={['#EFB3C2', '#4A2238']}
      />
    </section>
  );
}

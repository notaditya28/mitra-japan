import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-plum text-blush/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          <span className="font-display text-paper">Mitra Japan</span> · {t('footer.made')}
        </p>
        <p className="text-xs text-blush/70">{t('footer.demo')}</p>
      </div>
    </footer>
  );
}

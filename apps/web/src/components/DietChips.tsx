import { useTranslation } from 'react-i18next';
import { useAppStore, type Diet } from '../store/useAppStore';

const DEFAULT_DIETS: Diet[] = ['jain', 'vegetarian', 'vegan', 'halal', 'no-beef', 'eggless'];

export function DietChips({ diets = DEFAULT_DIETS }: { diets?: Diet[] }) {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const setDiet = useAppStore((s) => s.setDiet);

  return (
    <div role="group" aria-label={t('diets.label')} className="flex flex-wrap gap-1.5">
      {diets.map((d) => {
        const active = d === diet;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            onClick={() => setDiet(d)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-300 ${
              active
                ? 'border-plum bg-plum text-paper'
                : 'border-petal bg-blush text-plum hover:border-rose'
            }`}
          >
            {t(`diets.${d}`)}
          </button>
        );
      })}
    </div>
  );
}

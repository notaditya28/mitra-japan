import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import samples from '../../data/sampleDishes.json';
import { DietChips } from '../../components/DietChips';
import { VerdictPill } from '../../components/VerdictPill';
import { explainScan } from '../scanner/explain';
import { matchIngredients } from '../scanner/matchIngredients';
import { useAppStore } from '../../store/useAppStore';

/**
 * Mini menu-scanner for the "Will I find veg food?" gate.
 * DEMO PATH: curated menu text from sampleDishes.json run through the real
 * ingredient matcher. No OCR here; the live camera scanner is milestone 6.
 */
export function FoodScanPreview() {
  const { t } = useTranslation();
  const diet = useAppStore((s) => s.diet);
  const [dishId, setDishId] = useState(samples.dishes[0]?.id ?? '');
  const dish = samples.dishes.find((d) => d.id === dishId) ?? samples.dishes[0];
  const result = useMemo(() => matchIngredients(dish?.menuText ?? '', diet), [dish, diet]);

  if (!dish) return null;
  const hidden = dish.looksSafe && result.verdict === 'conflict';

  return (
    <div className="rounded-2xl border border-blush bg-paper p-4 text-sm">
      <p className="mb-2 inline-block rounded-full bg-mist/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mist">
        {t('scanner.demoLabel')}
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t('scanner.dish')}>
        {samples.dishes.map((d) => (
          <button
            key={d.id}
            type="button"
            lang="ja"
            aria-pressed={d.id === dishId}
            onClick={() => setDishId(d.id)}
            className={`rounded-lg px-2 py-1 text-xs transition-colors ${
              d.id === dishId ? 'bg-plum text-paper' : 'bg-blush text-plum hover:bg-petal'
            }`}
          >
            {d.ja}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p lang="ja" className="font-display text-lg leading-tight text-plum">
            {dish.ja}
          </p>
          <p className="text-xs text-mist">{dish.en}</p>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={result.verdict}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <VerdictPill verdict={result.verdict} />
          </motion.span>
        </AnimatePresence>
      </div>

      <ul className="space-y-1" aria-live="polite">
        {result.matches.length === 0 ? (
          <li className="text-xs text-mist">{t('scanner.noneFound')}</li>
        ) : (
          result.matches.map((m) => (
            <li
              key={m.ingredient.id}
              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${
                m.rule === 'avoid'
                  ? 'bg-torii/10 text-torii'
                  : m.rule === 'ask'
                    ? 'bg-gold/20 text-plum'
                    : 'text-ink'
              }`}
            >
              <span lang="ja">{m.term}</span>
              <span className="text-right text-xs font-medium">{m.ingredient.en}</span>
            </li>
          ))
        )}
      </ul>

      <p className="mt-3 text-xs font-semibold text-plum">{explainScan(result, t)}</p>
      {hidden ? <p className="mt-1 text-xs text-mist">{t('scanner.explain.hidden')}</p> : null}
      <p className="mt-2 text-[11px] leading-snug text-mist">{t('scanner.caveat')}</p>
      <div className="mt-3 border-t border-blush pt-3">
        <DietChips diets={['jain', 'vegetarian', 'vegan', 'halal']} />
      </div>
    </div>
  );
}

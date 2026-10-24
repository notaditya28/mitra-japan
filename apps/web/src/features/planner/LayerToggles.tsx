import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAppStore, type MapLayer } from '../../store/useAppStore';
import { LAYER_COLORS } from './map/layerColors';

const ORDER: MapLayer[] = ['vegSafe', 'heritage', 'anime', 'regional'];

/** Map layer switches. Each swatch matches its pin colour on the map. */
export function LayerToggles() {
  const { t } = useTranslation();
  const layers = useAppStore((s) => s.layers);
  const toggle = useAppStore((s) => s.toggleLayer);

  return (
    <fieldset id="map-layers" className="scroll-mt-2">
      <legend className="eyebrow mb-3 text-rose">{t('planner.layersTitle')}</legend>
      <ul className="space-y-2">
        {ORDER.map((l) => {
          const on = layers[l];
          return (
            <li key={l}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={t(`planner.layers.${l}.name`)}
                onClick={() => toggle(l)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                  on
                    ? 'border-transparent bg-plum text-paper'
                    : 'border-blush bg-white/70 text-plum hover:border-petal'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white/60"
                  style={{ background: LAYER_COLORS[l] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {t(`planner.layers.${l}.name`)}
                  </span>
                  <span className={`block text-xs ${on ? 'text-blush/80' : 'text-mist'}`}>
                    {t(`planner.layers.${l}.hint`)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-sakura' : 'bg-blush'}`}
                >
                  <motion.span
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${on ? 'right-0.5' : 'left-0.5'}`}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

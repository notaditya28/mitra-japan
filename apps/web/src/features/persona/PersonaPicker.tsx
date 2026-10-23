import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { PERSONAS } from './personas';
import { PersonaIcon } from './PersonaIcon';

export function PersonaPicker() {
  const { t } = useTranslation();
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);

  return (
    <div
      role="group"
      aria-label={t('persona.eyebrow')}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      {PERSONAS.map(({ id, tint }) => {
        const active = persona === id;
        return (
          <motion.button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => setPersona(id)}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className={`card group relative flex flex-col items-start gap-3 p-5 text-left transition-colors duration-300 ${
              active ? 'border-transparent ring-2' : 'hover:border-petal'
            }`}
            style={
              active
                ? { boxShadow: `0 0 0 2px rgb(${tint}), 0 18px 40px -18px rgb(${tint} / 0.6)` }
                : undefined
            }
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl transition-colors duration-300"
              style={{
                background: `rgb(${tint} / ${active ? 1 : 0.16})`,
                color: active ? '#fff' : `rgb(${tint})`,
              }}
            >
              <PersonaIcon id={id} className="h-6 w-6" />
            </span>
            <span className="font-semibold text-plum">{t(`persona.options.${id}.label`)}</span>
            <span className="text-sm leading-snug text-mist">
              {t(`persona.options.${id}.hint`)}
            </span>
            {active ? (
              <span className="chip absolute right-3 top-3 !px-2 !py-0.5 text-xs">
                {t('persona.selected')}
              </span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}

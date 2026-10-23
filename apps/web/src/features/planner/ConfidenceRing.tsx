import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { palette } from '../../styles/tokens';
import type { ConfidenceLevel } from './foodConfidence';

const COLOR: Record<ConfidenceLevel, string> = {
  high: palette.matcha,
  medium: palette.gold,
  low: palette.sakura,
};

/** Food Confidence ring: matcha = good options, gold = plan ahead, sakura = take care. */
export function ConfidenceRing({
  score,
  level,
  size = 64,
}: {
  score: number;
  level: ConfidenceLevel;
  size?: number;
}) {
  const { t } = useTranslation();
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={`${t('confidence.title')}: ${score} ${t('confidence.outOf')}, ${t(`confidence.levels.${level}`)}`}
      >
        <circle cx="32" cy="32" r={r} fill="none" stroke={palette.blush} strokeWidth="7" />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={COLOR[level]}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.1, ease: [0.33, 1, 0.68, 1] }}
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill={palette.plum}>
          {score}
        </text>
      </svg>
      <div className="leading-tight">
        <p className="text-xs font-semibold uppercase tracking-wide text-mist">
          {t('confidence.title')}
        </p>
        <p className="text-sm font-bold text-plum">{t(`confidence.levels.${level}`)}</p>
      </div>
    </div>
  );
}

interface LanternProps {
  className?: string;
  glow?: string;
}

/** Paper chochin lantern with a warm glow. */
export function Lantern({ className = '', glow = '#F0C27B' }: LanternProps) {
  return (
    <svg className={className} viewBox="0 0 120 200" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="lantern-glow">
          <stop offset="0%" stopColor={glow} stopOpacity="0.55" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lantern-paper" x1="0" x2="1">
          <stop offset="0%" stopColor="#E9A36B" />
          <stop offset="50%" stopColor="#FBE3C4" />
          <stop offset="100%" stopColor="#E9A36B" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="108" r="60" fill="url(#lantern-glow)" />
      <line x1="60" y1="0" x2="60" y2="40" stroke="#3A2430" strokeWidth="2" />
      <rect x="40" y="40" width="40" height="10" rx="2" fill="#3A2430" />
      <ellipse cx="60" cy="108" rx="40" ry="58" fill="url(#lantern-paper)" />
      {[78, 94, 110, 126, 142].map((y) => (
        <path
          key={y}
          d={`M${24 + Math.abs(y - 108) / 3} ${y} Q60 ${y + 5} ${96 - Math.abs(y - 108) / 3} ${y}`}
          stroke="#C0394B"
          strokeOpacity="0.35"
          fill="none"
          strokeWidth="1.5"
        />
      ))}
      <rect x="40" y="164" width="40" height="10" rx="2" fill="#3A2430" />
    </svg>
  );
}

interface SunDiscProps {
  className?: string;
  color?: string;
}

/** Flat sun disc with a soft halo. */
export function SunDisc({ className = '', color = '#F0C27B' }: SunDiscProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="sun-halo">
          <stop offset="55%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#sun-halo)" />
      <circle cx="100" cy="100" r="58" fill={color} />
    </svg>
  );
}

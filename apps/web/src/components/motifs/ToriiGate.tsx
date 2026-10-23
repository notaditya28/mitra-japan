interface ToriiGateProps {
  className?: string;
  color?: string;
  beam?: string;
  title?: string;
}

/** Myojin-style torii: curved kasagi, nuki tie beam, two slightly splayed pillars. */
export function ToriiGate({
  className = '',
  color = '#C0394B',
  beam = '#3A2430',
  title,
}: ToriiGateProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 220"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {/* kasagi (top beam, upturned ends) */}
      <path d="M6 22 C60 34 180 34 234 22 L230 38 C176 46 64 46 10 38 Z" fill={beam} />
      <path d="M18 38 C70 46 170 46 222 38 L220 52 C168 58 72 58 20 52 Z" fill={color} />
      {/* gakuzuka (centre strut) */}
      <rect x="112" y="54" width="16" height="28" fill={color} />
      {/* nuki (tie beam) */}
      <rect x="26" y="80" width="188" height="14" rx="2" fill={color} />
      {/* pillars */}
      <path d="M52 52 L68 52 L72 214 L48 214 Z" fill={color} />
      <path d="M172 52 L188 52 L192 214 L168 214 Z" fill={color} />
      {/* kamebara (bases) */}
      <rect x="44" y="204" width="32" height="12" rx="2" fill={beam} />
      <rect x="164" y="204" width="32" height="12" rx="2" fill={beam} />
    </svg>
  );
}

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { seigaihaDataUri } from '../../lib/seigaiha';

interface SeigaihaProps {
  line?: string;
  bg?: string;
  lineOpacity?: number;
  radius?: number;
  className?: string;
  children?: ReactNode;
}

/** Low-contrast seigaiha wave background. Purely decorative. */
export function Seigaiha({
  line = '#4A2238',
  bg = '#FFF8FA',
  lineOpacity = 0.07,
  radius = 32,
  className = '',
  children,
}: SeigaihaProps) {
  const style = useMemo<CSSProperties>(
    () => ({
      backgroundImage: seigaihaDataUri({ line, bg, lineOpacity, radius }),
      backgroundSize: `${radius * 2}px ${radius}px`,
    }),
    [line, bg, lineOpacity, radius],
  );
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

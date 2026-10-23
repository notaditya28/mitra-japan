import type { Motif } from './motifs';

/** Small flat motifs for the mosaic: Japanese (torii, sakura, wave, sun) and Indian (lotus, diya). */
export function TileMotif({ motif, color }: { motif: Motif; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" aria-hidden="true" focusable="false">
      {motif === 'torii' ? (
        <g fill={color}>
          <path d="M2 5c6 1.4 14 1.4 20 0l-.6 2.2c-6 1-12.8 1-18.8 0z" />
          <rect x="4" y="9.2" width="16" height="1.6" />
          <rect x="6" y="7" width="1.8" height="14" />
          <rect x="16.2" y="7" width="1.8" height="14" />
        </g>
      ) : null}
      {motif === 'sakura' ? (
        <g fill={color} transform="translate(12 12)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5.4" rx="3.2" ry="4.6" transform={`rotate(${a})`} />
          ))}
          <circle r="1.8" fill="#FFF8FA" opacity="0.7" />
        </g>
      ) : null}
      {motif === 'lotus' ? (
        <g fill={color}>
          <path d="M12 4c2.4 2.6 3.4 5.6 3 9-.6 2.6-1.6 4.4-3 5.6-1.4-1.2-2.4-3-3-5.6-.4-3.4.6-6.4 3-9z" />
          <path d="M3 10c3 0 5.6 1.4 7.4 4.6.8 1.6 1.2 3 1.4 4.4-3.6-.2-6.4-1.6-8-4.2C3 13.4 2.8 11.8 3 10zM21 10c.2 1.8 0 3.4-.8 4.8-1.6 2.6-4.4 4-8 4.2.2-1.4.6-2.8 1.4-4.4C15.4 11.4 18 10 21 10z" />
          <rect x="4" y="19.4" width="16" height="1.4" rx="0.7" />
        </g>
      ) : null}
      {motif === 'wave' ? (
        <g fill="none" stroke={color} strokeWidth="1.6">
          <path d="M3 18a9 9 0 0 1 18 0" />
          <path d="M6.5 18a5.5 5.5 0 0 1 11 0" />
          <path d="M10 18a2 2 0 0 1 4 0" />
        </g>
      ) : null}
      {motif === 'sun' ? <circle cx="12" cy="12" r="7" fill={color} /> : null}
      {motif === 'diya' ? (
        <g fill={color}>
          <path d="M12 3.5c2.2 2.8 2.4 5.6.2 7.8-2.4-2.2-2.4-5 0-7.8z" />
          <path d="M3 13.5h18c-1 4.2-4.6 6.8-9 6.8S4 17.7 3 13.5z" />
        </g>
      ) : null}
    </svg>
  );
}

import type { Persona } from '../../store/useAppStore';

const PATHS: Record<Persona, string> = {
  family:
    'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21v-4a5 5 0 0 1 10 0v4M13 21v-3a4 4 0 0 1 8 0v3M12 15a2 2 0 1 0 0-4',
  honeymoon: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  student: 'M2 9l10-5 10 5-10 5L2 9Zm4 2v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6',
  foodie: 'M3 12h18a9 9 0 0 1-18 0ZM8 21h8M14 3l-4 7M19 4l-6 6',
  spiritual:
    'M12 19c-3-2-4-5-4-8 2 0 3.5 1 4 2 .5-1 2-2 4-2 0 3-1 6-4 8Zm0 0c-4 0-8-2-9-5 2-.5 4 0 5 1M12 19c4 0 8-2 9-5-2-.5-4 0-5 1M12 4c1 1.5 1.5 3 0 6-1.5-3-1-4.5 0-6Z',
};

export function PersonaIcon({ id, className = '' }: { id: Persona; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[id]} />
    </svg>
  );
}

import type { Persona } from '../../store/useAppStore';

export interface PersonaMeta {
  id: Persona;
  /** RGB triplet written to --tint when selected. Stays inside the warm palette family. */
  tint: string;
}

export const PERSONAS: readonly PersonaMeta[] = [
  { id: 'family', tint: '240 194 123' }, // gold
  { id: 'honeymoon', tint: '217 87 127' }, // sakura
  { id: 'student', tint: '186 120 168' }, // orchid
  { id: 'foodie', tint: '192 57 75' }, // torii red
  { id: 'spiritual', tint: '222 150 84' }, // saffron
];

export function tintFor(persona: Persona | null): string {
  return PERSONAS.find((p) => p.id === persona)?.tint ?? '217 87 127';
}

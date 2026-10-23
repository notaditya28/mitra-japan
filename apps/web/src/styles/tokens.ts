// Hex mirror of tokens.css for three.js materials and canvas drawing.
export const palette = {
  plum: '#4A2238',
  sakura: '#D9577F',
  rose: '#C2456E',
  blush: '#FBE3EA',
  petal: '#F7C6D0',
  paper: '#FFF8FA',
  ink: '#3A2430',
  mist: '#8A6B77',
  gold: '#F0C27B',
  matcha: '#8FD19E',
  torii: '#C0394B',
} as const;

export type PaletteName = keyof typeof palette;

/** The four worries the journey answers, in order. */
export const FEAR_IDS = ['food', 'language', 'visa', 'foreign'] as const;
export type FearId = (typeof FEAR_IDS)[number];

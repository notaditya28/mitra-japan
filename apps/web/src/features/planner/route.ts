/**
 * A route the map can draw: an ordered list of stops with their day number.
 * Milestone 5 builds this from the AI itinerary; until then the planner can
 * preview a clearly labelled sample (the classic Golden Route).
 */
export interface RouteStop {
  cityId: string;
  day: number;
}

export const SAMPLE_ROUTE: RouteStop[] = [
  { cityId: 'tokyo', day: 1 },
  { cityId: 'hakone', day: 2 },
  { cityId: 'kyoto', day: 3 },
  { cityId: 'nara', day: 4 },
  { cityId: 'osaka', day: 5 },
];

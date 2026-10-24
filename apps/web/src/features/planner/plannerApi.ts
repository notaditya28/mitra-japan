import sampleItinerary from '../../data/sampleItinerary.json';
import type { Diet, Language, Persona } from '../../store/useAppStore';
import { parseDay, parseItinerary, type Day, type Itinerary, type Pace } from './itinerary';
import type { Budget, Interest, StartCity } from './tripPrefs';

export const API =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8000';

export interface PlanBody {
  prompt: string;
  persona: Persona | null;
  diet: Diet;
  language: Language;
  days?: number;
  previous?: Itinerary;
  /** Team guide trip inputs (all optional for the API). */
  startCity?: StartCity;
  travellers?: number;
  pace?: Pace | null;
  budget?: Budget;
  interests?: Interest[];
  diets?: Diet[];
}

export type PlannerErrorCode =
  | 'bad_request'
  | 'rate_limited'
  | 'payload_too_large'
  | 'offline'
  | 'invalid_response'
  | 'demo_mode'
  | 'ai_unavailable'
  | 'ai_busy'
  | 'ai_invalid'
  | 'ai_declined'
  | 'invalid_patch'
  | 'undo_unavailable'
  | 'index_missing'
  | 'unknown';

export interface PlannerError {
  code: PlannerErrorCode;
  message: string;
  status?: number;
  retryAfter?: number;
}

export interface PlanHandlers {
  onStatus?: (stage: string, days?: number) => void;
  onDay?: (day: Day) => void;
  onNotice?: (code: string, message: string) => void;
  onFinal: (itinerary: Itinerary) => void;
  onError: (error: PlannerError) => void;
}

export interface SseEvent {
  event: string;
  data: unknown;
}

/** Split a Server-Sent Events buffer into complete events plus the unfinished remainder. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (data.length === 0) continue;
    try {
      events.push({ event, data: JSON.parse(data.join('\n')) });
    } catch {
      // Ignore a corrupt event; the final itinerary is validated on its own.
    }
  }
  return { events, rest };
}

const KNOWN: PlannerErrorCode[] = [
  'bad_request',
  'rate_limited',
  'payload_too_large',
  'demo_mode',
  'ai_unavailable',
  'ai_busy',
  'ai_invalid',
  'ai_declined',
  'invalid_patch',
  'undo_unavailable',
  'index_missing',
];

/** Read a structured API error ({ error: { code, message } }) into a PlannerError. */
export async function readError(res: Response): Promise<PlannerError> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; retryAfter?: number };
    };
    const code = KNOWN.find((k) => k === body.error?.code) ?? 'unknown';
    return {
      code,
      message: body.error?.message ?? res.statusText,
      status: res.status,
      retryAfter: body.error?.retryAfter,
    };
  } catch {
    return { code: 'unknown', message: res.statusText, status: res.status };
  }
}

/** The built-in sample used when the API cannot be reached at all. Always labelled sample. */
export function offlineSample(): Itinerary | null {
  return parseItinerary(sampleItinerary);
}

/** Stream a plan from the API. Resolves when the stream ends; all results arrive via handlers. */
export async function streamPlan(
  body: PlanBody,
  handlers: PlanHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    handlers.onError({ code: 'offline', message: 'The planner service is not reachable.' });
    const sample = offlineSample();
    if (sample) handlers.onFinal(sample);
    return;
  }
  if (!res.ok || !res.body) {
    handlers.onError(await readError(res));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let gotFinal = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSse(buffer);
    buffer = rest;
    for (const { event, data } of events) {
      const d = data as Record<string, unknown>;
      if (event === 'status')
        handlers.onStatus?.(String(d.stage), typeof d.days === 'number' ? d.days : undefined);
      else if (event === 'notice') handlers.onNotice?.(String(d.code), String(d.message));
      else if (event === 'day') {
        const day = parseDay(d.day);
        if (day) handlers.onDay?.(day);
      } else if (event === 'final') {
        const it = parseItinerary(d.itinerary);
        gotFinal = true;
        if (it) handlers.onFinal(it);
        else
          handlers.onError({
            code: 'invalid_response',
            message: 'The itinerary could not be validated.',
          });
      }
    }
  }
  if (!gotFinal)
    handlers.onError({
      code: 'invalid_response',
      message: 'The planner stopped before finishing.',
    });
}

export interface DayBody {
  itinerary: Itinerary;
  day: number;
  instruction: string;
  persona: Persona | null;
  diet: Diet;
  language: Language;
  pace?: Pace | null;
}

export async function regenerateDay(
  body: DayBody,
): Promise<{ day: Day } | { error: PlannerError }> {
  let res: Response;
  try {
    res = await fetch(`${API}/api/plan/day`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { error: { code: 'offline', message: 'The planner service is not reachable.' } };
  }
  if (!res.ok) return { error: await readError(res) };
  const day = parseDay(await res.json());
  return day
    ? { day }
    : { error: { code: 'invalid_response', message: 'The new day could not be validated.' } };
}

export type ServiceMode = 'live' | 'demo' | 'offline';

export async function serviceMode(): Promise<ServiceMode> {
  try {
    const res = await fetch(`${API}/health`);
    if (!res.ok) return 'offline';
    const body = (await res.json()) as { mode?: string };
    return body.mode === 'live' ? 'live' : 'demo';
  } catch {
    return 'offline';
  }
}

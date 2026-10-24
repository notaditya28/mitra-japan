import { API, readError, type PlannerError } from '../planner/plannerApi';
import { parseItinerary, type Itinerary } from '../planner/itinerary';
import type { ApplyResult, AssistantResponse, Patch } from './types';

export type Result<T> = { ok: true; value: T } | { ok: false; error: PlannerError };

const OFFLINE: PlannerError = { code: 'offline', message: 'The guide service is not reachable.' };

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return { ok: false, error: OFFLINE };
  }
  if (!res.ok) return { ok: false, error: await readError(res) };
  try {
    return { ok: true, value: (await res.json()) as T };
  } catch {
    return { ok: false, error: { code: 'invalid_response', message: 'Unreadable response.' } };
  }
}

function isResponse(v: unknown): v is AssistantResponse {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.answer === 'string' && Array.isArray(o.citations) && Array.isArray(o.statements);
}

export interface ChatBody {
  message: string;
  session_id: string;
  trip_context: unknown;
  language: 'en' | 'hi' | 'gu';
  history: { role: 'user' | 'assistant'; text: string }[];
}

export async function chat(
  body: ChatBody,
  signal?: AbortSignal,
): Promise<Result<AssistantResponse>> {
  const r = await post<unknown>('/api/assistant/chat', body, signal);
  if (!r.ok) return r;
  return isResponse(r.value)
    ? { ok: true, value: r.value }
    : { ok: false, error: { code: 'invalid_response', message: 'The answer could not be read.' } };
}

export async function applyPatch(body: {
  session_id: string;
  itinerary: Itinerary;
  patch: Patch;
  pinned: string[];
}): Promise<Result<ApplyResult>> {
  const r = await post<ApplyResult & { itinerary: unknown }>('/api/assistant/apply-patch', body);
  if (!r.ok) return r;
  const itinerary = parseItinerary(r.value.itinerary);
  if (!itinerary)
    return {
      ok: false,
      error: { code: 'invalid_response', message: 'The new plan could not be validated.' },
    };
  return { ok: true, value: { ...r.value, itinerary } };
}

export async function undo(sessionId: string, token: string): Promise<Result<Itinerary>> {
  const r = await post<{ itinerary: unknown }>('/api/assistant/undo', {
    session_id: sessionId,
    undo_token: token,
  });
  if (!r.ok) return r;
  const itinerary = parseItinerary(r.value.itinerary);
  return itinerary
    ? { ok: true, value: itinerary }
    : { ok: false, error: { code: 'invalid_response', message: 'Bad itinerary.' } };
}

export async function getServerTripData(
  sessionId: string,
): Promise<Result<{ stored_on_server: boolean; storage: string; trip_context: unknown }>> {
  try {
    const res = await fetch(`${API}/api/trip-data?session_id=${encodeURIComponent(sessionId)}`);
    if (!res.ok) return { ok: false, error: await readError(res) };
    return { ok: true, value: await res.json() };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

export async function deleteServerTripData(
  sessionId: string,
): Promise<Result<{ deleted: boolean }>> {
  try {
    const res = await fetch(`${API}/api/trip-data?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) return { ok: false, error: await readError(res) };
    return { ok: true, value: await res.json() };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

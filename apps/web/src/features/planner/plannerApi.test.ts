import { afterEach, describe, expect, it, vi } from 'vitest';
import sample from '../../data/sampleItinerary.json';
import type { Itinerary } from './itinerary';
import {
  parseSse,
  readError,
  regenerateDay,
  serviceMode,
  streamPlan,
  type PlannerError,
} from './plannerApi';

const body = {
  prompt: '5 days, parents, Jain',
  persona: 'family' as const,
  diet: 'jain' as const,
  language: 'en' as const,
};

function sseResponse(text: string): Response {
  const bytes = new TextEncoder().encode(text);
  // Deliver in small, awkward chunks to exercise the buffer handling.
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += 23) c.enqueue(bytes.slice(i, i + 23));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const ev = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

afterEach(() => vi.unstubAllGlobals());

describe('parseSse', () => {
  it('returns complete events and keeps the unfinished tail', () => {
    const { events, rest } = parseSse(
      `${ev('status', { stage: 'planning' })}event: day\ndata: {"da`,
    );
    expect(events).toEqual([{ event: 'status', data: { stage: 'planning' } }]);
    expect(rest).toBe('event: day\ndata: {"da');
  });
});

describe('streamPlan', () => {
  it('streams validated day previews, then the final itinerary', async () => {
    const days = sample.days;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse(
          ev('status', { stage: 'planning', days: 5 }) +
            ev('day', { day: days[0] }) +
            ev('day', { day: { day: 2, cityId: 'atlantis' } }) + // invalid preview: ignored
            ev('final', { itinerary: sample }),
        ),
      ),
    );
    const seen: string[] = [];
    let final: Itinerary | null = null;
    await streamPlan(body, {
      onStatus: (s) => seen.push(`status:${s}`),
      onDay: (d) => seen.push(`day:${d.cityId}`),
      onFinal: (it) => (final = it),
      onError: (e) => seen.push(`error:${e.code}`),
    });
    expect(seen).toEqual(['status:planning', `day:${days[0]?.cityId}`]);
    expect(final).not.toBeNull();
  });

  it('reports a stream that ends without a final itinerary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(ev('status', { stage: 'planning' }))),
    );
    const errors: PlannerError[] = [];
    await streamPlan(body, { onFinal: () => undefined, onError: (e) => errors.push(e) });
    expect(errors[0]?.code).toBe('invalid_response');
  });

  it('falls back to the labelled offline sample when the API is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const errors: PlannerError[] = [];
    let final: Itinerary | null = null;
    await streamPlan(body, { onFinal: (it) => (final = it), onError: (e) => errors.push(e) });
    expect(errors[0]?.code).toBe('offline');
    expect((final as Itinerary | null)?.source).toBe('sample');
  });

  it('surfaces structured 429 errors without crashing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'rate_limited', message: 'Too many', retryAfter: 12 } },
          { status: 429 },
        ),
      ),
    );
    const errors: PlannerError[] = [];
    await streamPlan(body, { onFinal: () => undefined, onError: (e) => errors.push(e) });
    expect(errors[0]).toMatchObject({ code: 'rate_limited', status: 429, retryAfter: 12 });
  });
});

describe('errors and health', () => {
  it('maps unknown error codes to "unknown"', async () => {
    const e = await readError(
      Response.json({ error: { code: 'weird', message: 'x' } }, { status: 500 }),
    );
    expect(e.code).toBe('unknown');
  });

  it('reports demo mode from /health and offline when unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'ok', mode: 'demo' })),
    );
    expect(await serviceMode()).toBe('demo');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('x'))),
    );
    expect(await serviceMode()).toBe('offline');
  });

  it('explains that single-day regeneration needs the AI', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: { code: 'demo_mode', message: 'Off in demo' } }, { status: 503 }),
      ),
    );
    const r = await regenerateDay({
      itinerary: sample as Itinerary,
      day: 1,
      instruction: '',
      persona: null,
      diet: 'vegan',
      language: 'en',
    });
    expect('error' in r && r.error.code).toBe('demo_mode');
  });
});

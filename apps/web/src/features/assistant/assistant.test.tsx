import i18n from 'i18next';
import { renderToStaticMarkup } from 'react-dom/server';
import { initReactI18next } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sample from '../../data/sampleItinerary.json';
import en from '../../locales/en.json';
import { parseItinerary, type Itinerary } from '../planner/itinerary';
import { usePlannerStore } from '../planner/usePlannerStore';
import { DiffCard } from './DiffCard';
import { EmergencyCard } from './EmergencyCard';
import { diffCounts, safeUrl, statusOf } from './model';
import { EMERGENCY, missionsFor, nearbyFood, offlineEmergency, telHref } from './offline';
import { SourcesDrawer } from './SourcesDrawer';
import type { AssistantResponse, Citation } from './types';
import { useAssistantStore, type AssistantMessage } from './useAssistantStore';

// The components render through react-i18next; give them the English strings.
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
});

const itinerary = parseItinerary(sample) as Itinerary;
const lighter: Itinerary = {
  ...itinerary,
  days: itinerary.days.map((d) =>
    d.day === 3 ? { ...d, stops: d.stops.filter((_, i) => i !== 1) } : d,
  ),
};

function response(partial: Partial<AssistantResponse>): AssistantResponse {
  return {
    answer: '',
    statements: [],
    language: 'en',
    citations: [],
    confidence: 'medium',
    freshness_note: null,
    suggested_next_steps: [],
    proposed_patch: null,
    needs_clarification: null,
    intent: 'plan_change',
    emergency: null,
    mode: 'demo',
    mode_label: '',
    notices: [],
    trip_context: null,
    ...partial,
  };
}

const proposal: AssistantResponse['proposed_patch'] = {
  patch: {
    summary: 'Lighter day 3',
    ops: [{ op: 'resize_day', day: 3, keep: [0, 2] }],
    booking_notes: ['Change your hotel booking with the provider yourself.'],
  },
  warnings: [],
  diff: {
    changed: 1,
    unchanged_stops: 2,
    added_stops: 0,
    removed_stops: 1,
    days: [
      {
        day: 3,
        cityId: 'kyoto',
        title: 'Kyoto',
        status: 'changed',
        stops: [
          { name: 'Explore Kyoto', kind: 'culture', status: 'kept', pinned: false },
          { name: 'Temple shojin ryori lunch', kind: 'food', status: 'kept', pinned: true },
          { name: 'Joruri-ji, Kyoto', kind: 'heritage', status: 'removed', pinned: false },
        ],
      },
    ],
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('diff card: apply and undo', () => {
  beforeEach(() => {
    usePlannerStore.setState({ itinerary, previews: [] });
    const msg: AssistantMessage = {
      id: 'm1',
      role: 'assistant',
      response: response({ proposed_patch: proposal }),
      patchState: 'proposed',
    };
    useAssistantStore.setState({
      messages: [msg],
      undo: null,
      pinned: [],
      sessionId: 'testsession',
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders what changes, what stays and booking notes', () => {
    const m = useAssistantStore.getState().messages[0] as AssistantMessage;
    const html = renderToStaticMarkup(
      <DiffCard message={m} onApply={() => {}} onEdit={() => {}} onDismiss={() => {}} />,
    );
    expect(html).toContain('Lighter day 3');
    expect(html).toContain('Joruri-ji, Kyoto');
    expect(html).toContain('line-through'); // removed stop
    expect(html).toContain('Change your hotel booking with the provider yourself.');
    expect(diffCounts(proposal.diff?.days ?? [])).toEqual({
      added: 0,
      removed: 1,
      kept: 2,
      changedDays: 1,
    });
  });

  it('applies through the API, then undo restores the previous itinerary', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/apply-patch')
        ? jsonResponse({
            itinerary: lighter,
            undo_token: 'tok12345',
            diff: proposal.diff,
            warnings: [],
          })
        : jsonResponse({ itinerary }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { setTimeout: () => 0, localStorage: undefined });

    await useAssistantStore.getState().applyProposal('m1');
    expect(usePlannerStore.getState().itinerary?.days[2]?.stops).toHaveLength(2);
    expect((useAssistantStore.getState().messages[0] as AssistantMessage).patchState).toBe(
      'applied',
    );
    expect(useAssistantStore.getState().undo?.token).toBe('tok12345');

    await useAssistantStore.getState().undoLast();
    expect(usePlannerStore.getState().itinerary?.days[2]?.stops).toHaveLength(3);
    expect((useAssistantStore.getState().messages[0] as AssistantMessage).patchState).toBe(
      'undone',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('undo still works from the browser copy when the server is down', async () => {
    vi.stubGlobal('window', { setTimeout: () => 0 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ itinerary: lighter, undo_token: 'tok12345', diff: null, warnings: [] }),
      ),
    );
    await useAssistantStore.getState().applyProposal('m1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await useAssistantStore.getState().undoLast();
    expect(usePlannerStore.getState().itinerary?.days[2]?.stops).toHaveLength(3);
  });

  it('a rejected patch is shown as failed and the itinerary is untouched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: { code: 'invalid_patch', message: 'no' } }, 400)),
    );
    await useAssistantStore.getState().applyProposal('m1');
    const m = useAssistantStore.getState().messages[0] as AssistantMessage;
    expect(m.patchState).toBe('failed');
    expect(m.patchError).toBe('invalid_patch');
    expect(usePlannerStore.getState().itinerary?.days[2]?.stops).toHaveLength(3);
  });
});

describe('sources drawer', () => {
  const cite = (over: Partial<Citation>): Citation => ({
    n: 1,
    chunk_id: 'a#0',
    doc_id: 'a',
    title: 'Calling an ambulance in Japan (119)',
    section: 'The number',
    source_name: 'Fire and Disaster Management Agency',
    source_url: 'https://www.fdma.go.jp/x.pdf',
    source_type: 'official-government',
    status: 'needs-review',
    volatility: 'static',
    last_verified: '2026-10-24',
    excerpt: 'Call 119 for an ambulance.',
    ...over,
  });

  it('maps status and only links https sources', () => {
    expect(statusOf({ status: 'verified' })).toBe('verified');
    expect(statusOf({ status: 'anything' })).toBe('needs-review');
    expect(safeUrl('https://www.mofa.go.jp/')).toBe('https://www.mofa.go.jp/');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });

  it('lists title, source, verification date and status for each citation', () => {
    // Dialog contents render only when open; render the list markup directly.
    const html = renderToStaticMarkup(
      <SourcesDrawer
        citations={[
          cite({}),
          cite({
            n: 2,
            title: 'Team tips',
            source_url: null,
            source_type: 'team-written',
            last_verified: null,
          }),
        ]}
        focus={1}
        open
        onClose={() => {}}
      />,
    );
    expect(html).toContain('Calling an ambulance in Japan (119)');
    expect(html).toContain('href="https://www.fdma.go.jp/x.pdf"');
    expect(html).toContain('2026-10-24');
    expect(html).toContain('Team tips');
  });
});

describe('offline emergency fallback', () => {
  it('renders the urgent action, steps, tappable numbers and the disclaimer with no network', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    const payload = offlineEmergency('medical', ['kyoto'], 'en');
    const html = renderToStaticMarkup(<EmergencyCard payload={payload} />);
    expect(html).toContain('Call 119 now');
    expect(html).toContain('href="tel:119"');
    expect(html).toContain('050-3816-2787');
    expect(html).toContain(EMERGENCY.disclaimer.slice(0, 40));
    vi.unstubAllGlobals();
  });

  it("chooses the Indian mission for the traveller's city", () => {
    expect(missionsFor(['kyoto']).map((m) => m.name)).toEqual([
      'Consulate General of India, Osaka-Kobe',
    ]);
    expect(missionsFor(['tokyo']).map((m) => m.name)).toEqual(['Embassy of India, Tokyo']);
    expect(missionsFor(['fukuoka'])).toHaveLength(2); // unknown → show both
    const p = offlineEmergency('lost_passport', ['osaka'], 'hi');
    expect(p.urgent_action).toMatch(/[ऀ-ॿ]/);
    expect(p.contacts.some((c) => c.value.includes('+81-80-2524-1798'))).toBe(true);
  });

  it('makes dialable links from listed numbers', () => {
    expect(telHref('050-3816-2787')).toBe('tel:05038162787');
    expect(telHref('+81-80-2524-1798 / +81-80-8805-2207')).toBe('tel:+818025241798');
  });
});

describe('nearby food (location stays in the browser)', () => {
  it('ranks our places by diet suitability, then distance', () => {
    const near = nearbyFood(35.0116, 135.7681, 'vegan'); // central Kyoto
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((p) => p.km <= 30)).toBe(true);
    const firstUnsuited = near.findIndex((p) => !p.suits);
    if (firstUnsuited >= 0) expect(near.slice(firstUnsuited).every((p) => !p.suits)).toBe(true);
  });
});

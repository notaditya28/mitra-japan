import { describe, expect, it } from 'vitest';
import { STATES, VISA, groupItems, itemsFor, linkById, officeForState } from './visa';

const PREDICTS = /approval|be approved|guarantee|will be granted|reject|chance|success rate/i;

describe('visa checklist data', () => {
  it('stays marked for review and links only to official Japanese government sites', () => {
    expect(VISA.status).toBe('needs-review');
    for (const l of VISA.links)
      expect(l.url).toMatch(/^https:\/\/(www\.)?[a-z.-]*(mofa|emb-japan)\.go\.jp\//);
    for (const i of VISA.items) expect(linkById(i.link), i.id).toBeDefined();
  });

  it('never predicts outcomes or promises approval', () => {
    for (const i of VISA.items) expect(i.text, i.id).not.toMatch(PREDICTS);
    for (const p of VISA.pitfalls.items) expect(`${p.title} ${p.text}`, p.id).not.toMatch(PREDICTS);
  });

  it('marks where every line comes from, and the guide figures as team-guide', () => {
    for (const i of VISA.items) expect(['team-guide', 'official-summary']).toContain(i.source);
    expect(VISA.types.source).toBe('team-guide');
    expect(VISA.finance.source).toBe('team-guide');
    expect(VISA.jurisdictions.source).toBe('team-guide');
    expect(VISA.pitfalls.source).toBe('team-guide');
  });

  it('builds the list from purpose and traveller type only', () => {
    const tourist = itemsFor('tourism', 'employed').map((i) => i.id);
    expect(tourist).toContain('route-evisa');
    expect(tourist).toContain('itr');
    expect(tourist).toContain('employment');
    expect(tourist).not.toContain('invitation');
    const visiting = itemsFor('visiting', 'student').map((i) => i.id);
    expect(visiting).toContain('invitation');
    expect(visiting).toContain('student-proof');
    expect(visiting).not.toContain('route-evisa');
    expect(visiting).not.toContain('itr');
  });

  it('groups the checklist in the guide order: identity, money, schedule', () => {
    const groups = groupItems(itemsFor('tourism', 'employed')).map((g) => g.id);
    expect(groups).toEqual(['route', 'identity', 'finance', 'schedule']);
    expect(VISA.items.find((i) => i.id === 'schedule')?.action).toBe('schedule');
  });
});

describe('where to apply', () => {
  it('finds the office for a state, and says so when the guide does not list one', () => {
    expect(officeForState('Gujarat')?.id).toBe('mumbai');
    expect(officeForState('Karnataka')?.id).toBe('bengaluru');
    expect(officeForState('Ladakh')?.id).toBe('delhi');
    expect(officeForState('Chhattisgarh')).toBeUndefined();
  });

  it('lists every state once', () => {
    expect(new Set(STATES).size).toBe(STATES.length);
    const all = VISA.jurisdictions.offices.flatMap((o) => o.states);
    expect(new Set(all).size).toBe(all.length);
  });
});

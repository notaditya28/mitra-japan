import { describe, expect, it } from 'vitest';
import { VISA, itemsFor, linkById } from './visa';

describe('visa checklist data', () => {
  it('stays marked for review and links only to official Japanese government sites', () => {
    expect(VISA.status).toBe('needs-review');
    for (const l of VISA.links)
      expect(l.url).toMatch(/^https:\/\/(www\.)?[a-z.-]*(mofa|emb-japan)\.go\.jp\//);
    for (const i of VISA.items) expect(linkById(i.link), i.id).toBeDefined();
  });

  it('never predicts outcomes or promises approval', () => {
    for (const i of VISA.items)
      expect(i.text, i.id).not.toMatch(/approv|guarantee|will be granted|reject|chance/i);
  });

  it('builds the list from purpose and traveller type only', () => {
    const tourist = itemsFor('tourism', 'employed').map((i) => i.id);
    expect(tourist).toContain('route-evisa');
    expect(tourist).toContain('income');
    expect(tourist).not.toContain('invitation');
    const visiting = itemsFor('visiting', 'student').map((i) => i.id);
    expect(visiting).toContain('invitation');
    expect(visiting).toContain('student-proof');
    expect(visiting).not.toContain('route-evisa');
    expect(visiting).not.toContain('income');
  });
});

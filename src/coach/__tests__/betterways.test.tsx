import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BetterWays, summaryText } from '../../components/BetterWays';
import { LESSONS } from '../../lessons';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { coach } from '../index';

describe('Better ways panel', () => {
  const c = LESSONS['delete-to-char'].challenge as RoundsChallenge;
  const s = new Session({ ...c, rounds: [c.rounds[1]] }, { carryCursor: false });
  let t = 0;
  for (const k of parseKeys('kf,' + 'x'.repeat(16))) s.key(k, (t += 50));
  const report = coach(s, 'delete-to-char');
  const html = renderToStaticMarkup(<BetterWays report={report} unitLabel={u => `Round ${u + 1}`} />);
  it('leads with the key summary, in words', () => {
    const text = 'You pressed 19 keys: 3 moving the cursor, 0 typing text and 16 on commands. Par, the key count of a clean solution, is 6.';
    expect(summaryText(report.summary)).toBe(text);
    expect(html).toContain(text);
  });
  it('says what you pressed, what does the same, why, and the lesson that teaches it', () => {
    expect(html).toContain('You pressed');
    expect(html).toContain('does the same in');
    expect(html).toContain('Edit up to a character.');
    expect(html).toContain('No counting, and no selecting first.');
    expect(html).toContain('href="#delete-to-char"');
    expect(html).toContain('Practice it in Delete to Character →');
    expect(html).not.toContain('saves ');
  });
});

describe('a lesson round done some other way', () => {
  // A Visual Lines round solved by Vjp (paste over two lines). Deleting and retyping without V must
  // not get a ct) tip: the lesson's own solution is the advice.
  const c = LESSONS['visual-lines'].challenge as RoundsChallenge;
  const round = {
    setup: { text: ['app.use(auth);', 'app.get("/a", legacyA);', 'app.get("/b", legacyB);', 'app.listen(3000);'], registers: { '"': 'app.use("/api", router);\n' }, cursor: { line: 0, col: 0 } },
    goal: { text: ['app.use(auth);', 'app.use("/api", router);', 'app.listen(3000);'] },
    solution: 'jVjp',
  };
  const s = new Session({ ...c, rounds: [round] }, { carryCursor: false });
  let t = 0;
  for (const k of parseKeys('jjddkfgdt)iuse("/api", router<Esc>')) s.key(k, (t += 50));
  const report = coach(s, 'visual-lines');
  it('finishes the round', () => expect(s.done).toBe(true));
  it('gives no tip on a piece of the route', () => expect(report.critiques).toEqual([]));
  it("shows the lesson's own solution instead", () => expect(report.reference[0]?.ref).toBe('jVjp'));
});


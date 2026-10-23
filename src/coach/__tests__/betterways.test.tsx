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

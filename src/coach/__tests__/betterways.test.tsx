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
  it('leads with the key summary', () => {
    expect(summaryText(report.summary)).toBe('You used 19 keys: 3 moving, 0 typing, 16 editing. Par 6.');
    expect(html).toContain('You used 19 keys: 3 moving, 0 typing, 16 editing. Par 6.');
  });
  it('shows name — principle and a review link to the lesson that teaches it', () => {
    expect(html).toContain('Delete to a character');
    expect(html).toContain("operate up to a character you can see; don&#x27;t count");
    expect(html).toContain('href="#delete-to-char"');
    expect(html).toContain('Review: Delete to Character →');
  });
});

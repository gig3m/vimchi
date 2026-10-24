import { describe, expect, it } from 'vitest';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { segment } from '../segment';
import { closedSegments, nudgeLine } from '../live';

function log(keys: string) {
  const c: RoundsChallenge = { kind: 'rounds', base: { text: ['abc def ghi jkl', 'x'], name: 'a.ts', cursor: { line: 0, col: 0 } }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
  const s = new Session(c); let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  return s.log();
}

describe('live hints consider only closed segments', () => {
  it('a motion run still being typed is never a candidate', () => {
    const l = log('lllll');
    expect(closedSegments(segment(l), l, false)).toEqual([]);
  });
  it('the run closes when an edit follows it: the run, and the edit once it is settled', () => {
    const l = log('lllllx');
    const segs = segment(l);
    expect(closedSegments(segs, l, false)).toEqual([0, 1]);
  });
  it('an insert in progress is not closed; it is once Esc returns to normal', () => {
    const open = log('lllia');
    expect(closedSegments(segment(open), open, false)).toEqual([0]);
    const done = log('lllia<Esc>');
    expect(closedSegments(segment(done), done, false)).toEqual([0, 1]);
  });
  it('closing the round closes everything, including a trailing run', () => {
    const l = log('lllll');
    expect(closedSegments(segment(l), l, true)).toEqual([0]);
  });
});

describe('the live hint line', () => {
  const label = (u: number) => `Round ${u + 1}`;
  const n = { text: 'Search: n does that in 1 key instead of 6.', unit: 2 };
  it('shows in its own round, plain', () => { expect(nudgeLine(n, 2, label)).toBe(n.text); });
  it('stays one round, labelled with the round it is about', () => { expect(nudgeLine(n, 3, label)).toBe(`Round 3: ${n.text}`); });
  it('is dropped after that', () => { expect(nudgeLine(n, 4, label)).toBeNull(); expect(nudgeLine(null, 0, label)).toBeNull(); });
});

import { describe, expect, it } from 'vitest';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { segment } from '../segment';
import { closedSegments } from '../live';

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

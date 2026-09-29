import { describe, expect, it } from 'vitest';
import { Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { sameOutcome, stateBefore, stateNeeds } from '../replay';

function play(text: string[], keys: string) {
  const c: RoundsChallenge = { kind: 'rounds', base: { text, name: 'a.ts' }, rounds: [{ goal: { text: ['__never__'] }, solution: 'x' }] };
  const s = new Session(c);
  let t = 0;
  for (const k of parseKeys(keys)) s.key(k, (t += 50));
  return s;
}

describe('replay', () => {
  it('stateBefore rebuilds the exact state at a log index', () => {
    const s = play(['abc def', 'ghi'], 'wxjp');
    const v = stateBefore(s, 2);
    expect(v.buf.lines).toEqual(['abc ef', 'ghi']);
    expect(v.cursor).toEqual({ line: 0, col: 4 });
  });
  it('stateNeeds sees a later p reading the register', () => {
    const s = play(['abc def', 'ghi'], 'wxjp');
    expect(stateNeeds(s.log(), 1, 0)).toMatchObject({ register: true });
    expect(stateNeeds(s.log(), 3, 0)).toMatchObject({ register: false });
  });
  it('stateNeeds sees ; reading lastFind and n reading the search', () => {
    // afterIndex is the last log index of the segment under critique.
    expect(stateNeeds(play(['a,b,c,d'], 'f,;;').log(), 1, 0).lastFind).toBe(true);   // segment f, ; later ;; read it
    expect(stateNeeds(play(['foo bar foo'], '/foo<CR>n').log(), 4, 0).search).toBe(true); // segment /foo<CR>; n reads it
    expect(stateNeeds(play(['a,b,c,d'], 'f,x').log(), 1, 0).lastFind).toBe(false);
    expect(stateNeeds(play(['foo bar foo'], '/foo<CR>n').log(), 0, 0).search).toBe(false); // /foo rewrites it before n
  });
  it('state a later command reads must match', () => {
    const s = play(['abcd efg', 'x'], 'xxxxjp');
    const a = stateBefore(s, 0); a.feedKeys('xxxx');
    const b = stateBefore(s, 0); b.feedKeys('de');
    expect(a.buf.lines).toEqual(b.buf.lines);
    expect(sameOutcome(a, b, { register: false, lastFind: false, search: false, lastChange: false })).toBe(true);
    expect(sameOutcome(a, b, stateNeeds(s.log(), 3, 0))).toBe(false);
  });
});

describe('replay fix pass', () => {
  it('stateBefore starts from the carried-over cursor of a later round', () => {
    const c: RoundsChallenge = {
      kind: 'rounds', base: { text: ['abc def ghi', 'x'], name: 'a.ts' },
      rounds: [{ goal: { cursor: { line: 0, col: 4 } }, solution: 'w' }, { goal: { text: ['abc def gh', 'x'] }, solution: '$x' }],
    };
    const s = new Session(c);
    s.key('w', 50); s.advance();
    s.key('l', 100);
    const v = stateBefore(s, s.log().length - 1);
    expect(v.cursor).toEqual({ line: 0, col: 4 });
  });
});

import { describe, expect, it } from 'vitest';
import { createVim, Session } from '../../lessons/runtime';
import type { RoundsChallenge } from '../../lessons/types';
import { parseKeys } from '../../vim/keys';
import { segment } from '../segment';
import { shorterEdit, shorterSegment } from '../shorter';
import { taughtBy } from '../vocab';

const taught = taughtBy('repeat-last-change');

describe('shorterEdit', () => {
  it('f)lD on the last character was $x', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 4, taught)).toMatchObject({ keys: '$x', length: 2 });
  });
  it('a line below: jf;lD was j$x', () => {
    const v = createVim({ text: ['a b c', 'run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'a b c\nrun(a)\nnext();', 5, taught)?.keys).toBe('j$x');
  });
  it('nothing when the saving is under two keys', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 3, taught)).toBeNull();
  });
  it('only keys the learner has been taught', () => {
    const v = createVim({ text: ['run(a);', 'next();'], name: 'a.ts' });
    expect(shorterEdit(v, 'run(a)\nnext();', 4, new Set(['f', 'l', 'D', 'x']))).toBeNull();
  });
});

describe('shorterSegment', () => {
  it('finds it from a live session log', () => {
    const c: RoundsChallenge = { kind: 'rounds', base: { name: 'a.ts' }, rounds: [{ setup: { text: ['run(a);', 'next();', 'end();'] }, goal: { text: ['__'] }, solution: 'x' }] };
    const s = new Session(c);
    let t = 0;
    for (const k of parseKeys('f)lD')) s.key(k, (t += 50));
    const segs = segment(s.log());
    expect(shorterSegment(s, segs, segs.length - 1, taught)?.keys).toBe('$x');
  });
  it('a failed motion key on the way still counts as spent', () => {
    const c: RoundsChallenge = { kind: 'rounds', base: { name: 'a.ts' }, rounds: [{ setup: { text: ['run(a);', 'next();', 'end();'] }, goal: { text: ['__'] }, solution: 'x' }] };
    const s = new Session(c);
    let t = 0;
    for (const k of parseKeys('f;llD')) s.key(k, (t += 50)); // both l's beep at the end of the line
    const segs = segment(s.log());
    expect(shorterSegment(s, segs, segs.length - 1, taught)).toMatchObject({ keys: '$x', used: 5 });
  });
});
